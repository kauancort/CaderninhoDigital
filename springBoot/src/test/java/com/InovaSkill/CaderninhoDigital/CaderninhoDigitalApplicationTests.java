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

	@Test
	void contextLoads() {
		assertThat(flyway.info().applied()).hasSize(7);
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
