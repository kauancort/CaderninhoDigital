package db.migration;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class V11__secure_user_credentials extends BaseJavaMigration {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder(12);

    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE usuarios ALTER COLUMN senha TYPE VARCHAR(255)");
            statement.execute("ALTER TABLE usuarios ADD COLUMN troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT TRUE");
        }

        try (PreparedStatement select = connection.prepareStatement("SELECT id, senha FROM usuarios");
             ResultSet usuarios = select.executeQuery();
             PreparedStatement update = connection.prepareStatement("UPDATE usuarios SET senha = ? WHERE id = ?")) {
            while (usuarios.next()) {
                String senhaAtual = usuarios.getString("senha");
                if (!ehBcrypt(senhaAtual)) {
                    update.setString(1, PASSWORD_ENCODER.encode(senhaAtual));
                    update.setLong(2, usuarios.getLong("id"));
                    update.addBatch();
                }
            }
            update.executeBatch();
        }

        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM usuarios")) {
            result.next();
            if (result.getLong(1) == 0) {
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
    }

    private boolean ehBcrypt(String senha) {
        return senha != null && senha.matches("^\\$2[aby]\\$.*");
    }
}
