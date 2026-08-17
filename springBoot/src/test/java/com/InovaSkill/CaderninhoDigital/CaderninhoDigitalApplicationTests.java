package com.InovaSkill.CaderninhoDigital;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.time.LocalDate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class CaderninhoDigitalApplicationTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private Flyway flyway;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private VendaRepository vendaRepository;

	@Autowired
	private MateriaPrimaRepository materiaPrimaRepository;

	@Autowired
	private ProdutoRepository produtoRepository;

	@Test
	void contextLoads() {
		assertThat(flyway.info().applied()).hasSize(24);
		assertThat(jdbcTemplate.queryForObject(
				"SELECT senha LIKE '$2%' FROM usuarios WHERE email = 'adm@gmail.com'", Boolean.class)).isTrue();
		assertThat(jdbcTemplate.queryForObject(
				"SELECT troca_senha_obrigatoria FROM usuarios WHERE email = 'adm@gmail.com'", Boolean.class)).isTrue();
	}

	@Test
	@Transactional
	void bloqueiaProdutoDeOutraEmpresaNaRentabilidade() {
		Long empresaPrincipal = jdbcTemplate.queryForObject("SELECT MIN(id) FROM empresas", Long.class);
		Long outraEmpresa = jdbcTemplate.queryForObject("""
				INSERT INTO empresas (nome, criado_em) VALUES ('Empresa produto privado', CURRENT_TIMESTAMP)
				RETURNING id
				""", Long.class);
		Long outroGestor = jdbcTemplate.queryForObject("""
				INSERT INTO usuarios (cargo_funcao, criado_em, email, nome, perfil, senha,
				                      troca_senha_obrigatoria, empresa_id)
				VALUES ('Gestor', CURRENT_TIMESTAMP, 'produto-privado@example.invalid', 'Gestor privado',
				        'GESTOR', '$2a$10$abcdefghijklmnopqrstuv123456789012345678901234567890', false, ?)
				RETURNING id
				""", Long.class, outraEmpresa);
		Long produtoPrivado = jdbcTemplate.queryForObject("""
				INSERT INTO produtos (ativo, criado_em, estoque_atual, nome, preco_venda,
				                     unidade_medida, custo_atual, gestor_id)
				VALUES (true, CURRENT_TIMESTAMP, 10, 'Produto privado', 10, 'unidade', 5, ?)
				RETURNING id
				""", Long.class, outroGestor);

		assertThat(produtoRepository.buscarComGabaritoParaEmpresa(produtoPrivado, empresaPrincipal)).isEmpty();
		assertThat(produtoRepository.buscarComGabaritoParaEmpresa(produtoPrivado, outraEmpresa)).isPresent();
	}

	@Test
	@Transactional
	void bloqueiaMateriaPrimaDeOutraEmpresaNoContextoDaIa() {
		Long empresaPrincipal = jdbcTemplate.queryForObject("SELECT MIN(id) FROM empresas", Long.class);
		Long outraEmpresa = jdbcTemplate.queryForObject("""
				INSERT INTO empresas (nome, criado_em) VALUES ('Outra empresa', CURRENT_TIMESTAMP)
				RETURNING id
				""", Long.class);
		Long outroGestor = jdbcTemplate.queryForObject("""
				INSERT INTO usuarios (cargo_funcao, criado_em, email, nome, perfil, senha,
				                      troca_senha_obrigatoria, empresa_id)
				VALUES ('Gestor', CURRENT_TIMESTAMP, 'outra-empresa@example.invalid', 'Outro gestor',
				        'GESTOR', '$2a$10$abcdefghijklmnopqrstuv123456789012345678901234567890', false, ?)
				RETURNING id
				""", Long.class, outraEmpresa);
		Long materiaOutraEmpresa = jdbcTemplate.queryForObject("""
				INSERT INTO materias_primas (ativo, criado_em, custo_medio, estoque_atual, estoque_minimo,
				                              nome, unidade_medida, gestor_id)
				VALUES (true, CURRENT_TIMESTAMP, 5, 10, 1, 'Insumo privado', 'kg', ?)
				RETURNING id
				""", Long.class, outroGestor);

		assertThat(materiaPrimaRepository.buscarAcessivelParaAnalise(materiaOutraEmpresa, empresaPrincipal)).isEmpty();
		assertThat(materiaPrimaRepository.buscarAcessivelParaAnalise(materiaOutraEmpresa, outraEmpresa)).isPresent();
	}

	@Test
	void criaEstruturaDeCustosESnapshots() {
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM information_schema.columns
				 WHERE table_name = 'produtos' AND column_name = 'custo_atual'
				""", Integer.class)).isEqualTo(1);
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM information_schema.tables
				 WHERE table_name = 'historico_custos_produto'
				""", Integer.class)).isEqualTo(1);
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM information_schema.columns
				 WHERE table_name = 'itens_venda' AND column_name = 'custo_considerado'
				""", Integer.class)).isEqualTo(1);
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM information_schema.columns
				 WHERE table_name = 'itens_venda'
				   AND column_name IN ('modalidade_venda', 'quantidade_modalidade', 'unidades_por_modalidade')
				""", Integer.class)).isEqualTo(3);
	}

	@Test
	void criaVinculoAuditavelDaMovimentacaoComAOrigem() {
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM information_schema.columns
				 WHERE table_name = 'movimentacoes_estoque' AND column_name = 'origem_id'
				""", Integer.class)).isEqualTo(1);
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM pg_indexes
				 WHERE tablename = 'movimentacoes_estoque'
				   AND indexname = 'idx_movimentacoes_origem_id'
				""", Integer.class)).isEqualTo(1);
	}

	@Test
	void habilitaRlsNasTabelasDaAplicacao() {
		assertThat(jdbcTemplate.queryForObject("""
				SELECT COUNT(*)
				  FROM pg_class c
				  JOIN pg_namespace n ON n.oid = c.relnamespace
				 WHERE n.nspname = 'public'
				   AND c.relrowsecurity = TRUE
				   AND c.relname IN (
				       'usuarios', 'clientes', 'fornecedores', 'produtos', 'materias_primas',
				       'lancamentos', 'vendas', 'itens_venda', 'compras_materias_primas',
				       'itens_compra_materia_prima', 'producoes', 'itens_producao_materia_prima',
				       'insights', 'password_recoveries', 'produto_gabarito_itens',
				       'produto_gabaritos', 'movimentacoes_estoque', 'categorias_produto',
				       'historico_precos_produto', 'historico_custos_materia_prima',
				       'auditoria_operacoes', 'historico_custos_produto'
				   )
				""", Integer.class)).isEqualTo(22);
	}

	@Test
	void vinculaCatalogoInicialAEmpresaPrincipalSemDuplicidades() {
		assertThat(jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM produtos p JOIN usuarios u ON u.id = p.gestor_id "
					+ "WHERE u.empresa_id = (SELECT MIN(id) FROM empresas)", Integer.class)).isEqualTo(3);
		assertThat(jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM materias_primas m JOIN usuarios u ON u.id = m.gestor_id "
					+ "WHERE u.empresa_id = (SELECT MIN(id) FROM empresas)", Integer.class)).isEqualTo(7);
		assertThat(jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM produtos WHERE gestor_id IS NULL", Integer.class)).isZero();
		assertThat(jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM materias_primas WHERE gestor_id IS NULL", Integer.class)).isZero();
		assertThat(jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM produto_gabarito_itens", Integer.class)).isEqualTo(16);
	}

	@Test
	void executaAgregacoesFinanceirasDaIaNoPostgresql() {
		LocalDate inicio = LocalDate.of(2026, 8, 1);
		LocalDate fim = LocalDate.of(2026, 8, 7);
		Long empresaId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM empresas", Long.class);
		assertThat(vendaRepository.resumirVendasIa(empresaId, inicio, fim)).isNotNull();
		assertThat(vendaRepository.totalItensVendasIa(empresaId, inicio, fim)).isNotNull();
		assertThat(vendaRepository.resumirRecebiveisIa(
				empresaId, fim, fim.minusDays(1), fim.minusDays(7), fim.minusDays(8),
				fim.minusDays(30), "", inicio, fim)).isNotNull();
	}

	@Test
	void consultaItensDeRentabilidadeComOMetamodeloRealDoPostgresql() {
		Long empresaId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM empresas", Long.class);
		Long produtoId = jdbcTemplate.queryForObject("""
				SELECT MIN(p.id)
				  FROM produtos p
				  JOIN usuarios u ON u.id = p.gestor_id
				 WHERE u.empresa_id = ?
				""", Long.class, empresaId);

		assertThat(vendaRepository.listarItensRentabilidadeProduto(
				empresaId, produtoId, LocalDate.of(2020, 1, 1), LocalDate.of(2030, 12, 31)))
				.isNotNull();
	}

	@Test
	void resumeEstoqueDeMateriasPrimasNoPostgresql() {
		var linhas = materiaPrimaRepository.resumirEstoque("%%", true);

		assertThat(linhas).hasSize(1);
		assertThat(((Number) linhas.get(0)[0]).longValue()).isEqualTo(7L);
		assertThat(linhas.get(0)[2]).isInstanceOf(java.math.BigDecimal.class);
	}

	@Test
	@Transactional
	void geraIdentidadeEPersisteTiposDoPostgresql() {
		Long empresaId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM empresas", Long.class);
		Long id = jdbcTemplate.queryForObject("""
				INSERT INTO usuarios (cargo_funcao, criado_em, email, nome, perfil, senha, empresa_id)
				VALUES ('Gestor', CURRENT_TIMESTAMP, 'postgres@test.local', 'Teste PostgreSQL', 'GESTOR', 'senha', ?)
				RETURNING id
				""", Long.class, empresaId);

		assertThat(id).isPositive();
	}

}
