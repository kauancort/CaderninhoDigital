package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UsuarioResponseDTO {
    private Long id;
    private String nome;
    private String email;
    private String cargoFuncao;
    private PerfilUsuario perfil;
}
