package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContextoPlanejamentoService {
    private final UsuarioRepository usuarios;
    private final ProdutoRepository produtos;
    private final MateriaPrimaRepository materias;
    private final PoliticaDadosIa politica;
    private final AiOrchestratorProperties properties;

    public ContextoPlanejamentoService(UsuarioRepository usuarios, ProdutoRepository produtos,
            MateriaPrimaRepository materias, PoliticaDadosIa politica, AiOrchestratorProperties properties) {
        this.usuarios = usuarios; this.produtos = produtos; this.materias = materias;
        this.politica = politica; this.properties = properties;
    }

    @Transactional(readOnly = true)
    public Contexto carregar(Long usuarioId) {
        Long empresaId = empresaId(usuarioId);
        int limite = properties.getLimits().getContextItems();
        List<ItemCatalogo> produtosPermitidos = produtos.listarAtivosParaEmpresa(empresaId).stream()
                .filter(p -> politica.rotuloOperacionalPermitido(p.getNome())).limit(limite)
                .map(p -> new ItemCatalogo(p.getId(), p.getNome(), p.getUnidadeMedida())).toList();
        List<ItemCatalogo> materiasPermitidas = materias.listarAcessiveisParaAnalise(empresaId).stream()
                .filter(m -> politica.rotuloOperacionalPermitido(m.getNome())).limit(limite)
                .map(m -> new ItemCatalogo(m.getId(), m.getNome(), m.getUnidadeMedida())).toList();
        return new Contexto(empresaId, produtosPermitidos, materiasPermitidas);
    }

    public Long empresaId(Long usuarioId) {
        return usuarios.buscarEmpresaId(usuarioId).orElseThrow(() ->
                new OrquestradorException(CodigoErroOrquestrador.NAO_AUTORIZADO, HttpStatus.FORBIDDEN,
                        "Usuário sem empresa vinculada"));
    }

    public record ItemCatalogo(Long id, String nome, String unidade) {}
    public record Contexto(Long empresaId, List<ItemCatalogo> produtos, List<ItemCatalogo> materiasPrimas) {}
}
