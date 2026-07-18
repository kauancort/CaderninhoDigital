package com.InovaSkill.CaderninhoDigital.dto.response;

public record CategoriaProdutoResponseDTO(Long id, String nome, String descricao, Boolean ativo,
                                           Long categoriaPaiId, String categoriaPaiNome) {}
