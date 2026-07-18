package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;
import org.springframework.data.domain.Page;

public record PaginaResponseDTO<T>(
        List<T> registros,
        int paginaAtual,
        int tamanhoPagina,
        long totalRegistros,
        int totalPaginas,
        boolean temAnterior,
        boolean temProxima
) {
    public static <T> PaginaResponseDTO<T> de(Page<T> pagina) {
        return new PaginaResponseDTO<>(
                pagina.getContent(),
                pagina.getNumber(),
                pagina.getSize(),
                pagina.getTotalElements(),
                pagina.getTotalPages(),
                pagina.hasPrevious(),
                pagina.hasNext());
    }
}
