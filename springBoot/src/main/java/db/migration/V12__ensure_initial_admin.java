package db.migration;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class V12__ensure_initial_admin extends BaseJavaMigration {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder(12);

    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        try (PreparedStatement select = connection.prepareStatement(
                        "SELECT 1 FROM usuarios WHERE LOWER(email) = 'adm@gmail.com'");
             ResultSet resultado = select.executeQuery()) {
            if (resultado.next()) {
                return;
            }
        }

        try (PreparedStatement insert = connection.prepareStatement("""
                INSERT INTO usuarios
                    (cargo_funcao, criado_em, email, nome, perfil, senha, troca_senha_obrigatoria)
                VALUES
                    ('Administrador', CURRENT_TIMESTAMP, 'adm@gmail.com',
                     'Administrador inicial', 'GESTOR', ?, TRUE)
                """)) {
            insert.setString(1, PASSWORD_ENCODER.encode("123"));
            insert.executeUpdate();
        }
    }
}
