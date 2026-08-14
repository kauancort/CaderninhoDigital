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

	@Test
	void contextLoads() {
		assertThat(flyway.info().applied()).hasSize(20);
		assertThat(jdbcTemplate.queryForObject(
				"SELECT senha LIKE '$2%' FROM usuarios WHERE email = 'adm@gmail.com'", Boolean.class)).isTrue();
		assertThat(jdbcTemplate.queryForObject(
				"SELECT troca_senha_obrigatoria FROM usuarios WHERE email = 'adm@gmail.com'", Boolean.class)).isTrue();
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
	void carregaCatalogoInicialSemDuplicidades() {
		assertThat(jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM produtos WHERE gestor_id IS NULL", Integer.class)).isEqualTo(3);
		assertThat(jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM materias_primas WHERE gestor_id IS NULL", Integer.class)).isEqualTo(7);
		assertThat(jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM produto_gabarito_itens", Integer.class)).isEqualTo(16);
	}

	@Test
	void executaAgregacoesFinanceirasDaIaNoPostgresql() {
		LocalDate inicio = LocalDate.of(2026, 8, 1);
		LocalDate fim = LocalDate.of(2026, 8, 7);
		assertThat(vendaRepository.resumirVendasIa(inicio, fim)).isNotNull();
		assertThat(vendaRepository.totalItensVendasIa(inicio, fim)).isNotNull();
		assertThat(vendaRepository.resumirRecebiveisIa(
				fim, fim.minusDays(1), fim.minusDays(7), fim.minusDays(8),
				fim.minusDays(30), "", inicio, fim)).isNotNull();
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
		Long id = jdbcTemplate.queryForObject("""
				INSERT INTO usuarios (cargo_funcao, criado_em, email, nome, perfil, senha)
				VALUES ('Gestor', CURRENT_TIMESTAMP, 'postgres@test.local', 'Teste PostgreSQL', 'GESTOR', 'senha')
				RETURNING id
				""", Long.class);

		assertThat(id).isPositive();
	}

}
