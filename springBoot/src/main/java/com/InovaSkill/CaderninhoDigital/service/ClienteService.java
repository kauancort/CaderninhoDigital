package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ClienteResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    public ClienteResponseDTO criar(Long usuarioId, ClienteRequestDTO dto) {
        TipoCliente tipo = tipoCadastro(dto.getTipo());
        validarCadastro(dto, tipo);
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = Cliente.builder()
                .nome(dto.getNome())
                .email(normalizarOpcional(dto.getEmail()))
                .telefone(normalizarOpcional(dto.getTelefone()))
                .documento(normalizarOpcional(somenteDigitos(dto.getDocumento())))
                .endereco(normalizarOpcional(dto.getEndereco()))
                .numero(normalizarOpcional(dto.getNumero()))
                .complemento(normalizarOpcional(dto.getComplemento()))
                .cep(normalizarCep(dto.getCep()))
                .bairro(normalizarOpcional(dto.getBairro()))
                .cidade(normalizarOpcional(dto.getCidade()))
                .estado(normalizarOpcional(dto.getEstado()))
                .inscricaoEstadual(normalizarOpcional(dto.getInscricaoEstadual()))
                .ativo(dto.getAtivo())
                .tipo(tipo)
                .gestor(gestor)
                .build();
        return toResponse(clienteRepository.save(cliente));
    }

    public List<ClienteResponseDTO> listar(Long usuarioId) {
        usuarioAcessoService.buscarGestor(usuarioId);
        return clienteRepository.findAllByOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    public Page<ClienteResponseDTO> pesquisar(Long usuarioId, String busca, int pagina, int tamanho, Boolean ativo) {
        usuarioAcessoService.buscarGestor(usuarioId);
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        Specification<Cliente> filtro = (root, query, cb) -> {
            var p = cb.conjunction();
            if (!termo.isBlank()) {
                String like = "%" + termo + "%";
                p = cb.and(p, cb.or(
                        cb.like(cb.lower(root.get("nome")), like),
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("documento")), like)));
            }
            if (ativo != null) p = cb.and(p, cb.equal(root.get("ativo"), ativo));
            return p;
        };
        return clienteRepository.findAll(filtro, PageRequest.of(Math.max(0, pagina), Math.min(100, Math.max(1, tamanho)), Sort.by("nome")))
                .map(this::toResponse);
    }

    public ClienteResponseDTO buscar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        return toResponse(cliente);
    }

    public ClienteResponseDTO atualizar(Long usuarioId, Long id, ClienteRequestDTO dto) {
        TipoCliente tipo = tipoCadastro(dto.getTipo());
        validarCadastro(dto, tipo);
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        cliente.setNome(dto.getNome());
        cliente.setEmail(normalizarOpcional(dto.getEmail()));
        cliente.setTelefone(normalizarOpcional(dto.getTelefone()));
        cliente.setDocumento(normalizarOpcional(somenteDigitos(dto.getDocumento())));
        cliente.setEndereco(normalizarOpcional(dto.getEndereco()));
        cliente.setNumero(normalizarOpcional(dto.getNumero()));
        cliente.setComplemento(normalizarOpcional(dto.getComplemento()));
        cliente.setCep(normalizarCep(dto.getCep()));
        cliente.setBairro(normalizarOpcional(dto.getBairro()));
        cliente.setCidade(normalizarOpcional(dto.getCidade()));
        cliente.setEstado(normalizarOpcional(dto.getEstado()));
        cliente.setInscricaoEstadual(normalizarOpcional(dto.getInscricaoEstadual()));
        cliente.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : cliente.getAtivo());
        if (dto.getTipo() != null) {
            cliente.setTipo(dto.getTipo());
        }
        return toResponse(clienteRepository.save(cliente));
    }

    public void deletar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        clienteRepository.delete(cliente);
    }

    private Cliente buscarEntidade(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
    }

    private ClienteResponseDTO toResponse(Cliente cliente) {
        return ClienteResponseDTO.builder()
                .id(cliente.getId())
                .nome(cliente.getNome())
                .email(cliente.getEmail())
                .telefone(cliente.getTelefone())
                .documento(cliente.getDocumento())
                .endereco(cliente.getEndereco())
                .numero(cliente.getNumero())
                .complemento(cliente.getComplemento())
                .cep(cliente.getCep())
                .bairro(cliente.getBairro())
                .cidade(cliente.getCidade())
                .estado(cliente.getEstado())
                .inscricaoEstadual(cliente.getInscricaoEstadual())
                .ativo(cliente.getAtivo())
                .tipo(cliente.getTipo())
                .gestorId(cliente.getGestor().getId())
                .gestorNome(cliente.getGestor().getNome())
                .build();
    }

    private String normalizarCep(String cep) {
        if (cep == null || cep.isBlank()) return null;
        return cep.replaceAll("\\D", "");
    }

    private String normalizarOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private String somenteDigitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }

    private TipoCliente tipoCadastro(TipoCliente tipo) {
        return tipo == null ? TipoCliente.CLIENTE : tipo;
    }

    private void validarCadastro(ClienteRequestDTO dto, TipoCliente tipo) {
        if (dto.getNome() == null || dto.getNome().isBlank()) {
            throw new BusinessException("O nome é obrigatório");
        }

        if (tipo == TipoCliente.TRANSPORTADORA) {
            return;
        }

        exigirPreenchido(dto.getTelefone(), "O telefone é obrigatório");
        exigirPreenchido(dto.getDocumento(), "Informe o CPF ou CNPJ");
        exigirPreenchido(dto.getEndereco(), "Informe a rua ou o endereço");
        exigirPreenchido(dto.getNumero(), "Informe o número");
        exigirPreenchido(dto.getBairro(), "Informe o bairro");
        exigirPreenchido(dto.getCidade(), "Informe a cidade");
        exigirPreenchido(dto.getEstado(), "Selecione o estado");
        validarDocumento(dto.getDocumento());
    }

    private void exigirPreenchido(String valor, String mensagem) {
        if (valor == null || valor.isBlank()) {
            throw new BusinessException(mensagem);
        }
    }

    private void validarDocumento(String documento) {
        String valor = somenteDigitos(documento);
        if (valor.length() == 11 && validarCpf(valor)) return;
        if (valor.length() == 14 && validarCnpj(valor)) return;
        throw new BusinessException(valor.length() <= 11
                ? "O CPF informado não é válido"
                : "O CNPJ informado não é válido");
    }

    private boolean validarCpf(String cpf) {
        if (cpf.chars().distinct().count() == 1) return false;
        int soma = 0;
        for (int i = 0; i < 9; i++) soma += Character.digit(cpf.charAt(i), 10) * (10 - i);
        int d1 = 11 - soma % 11;
        if (d1 >= 10) d1 = 0;
        soma = 0;
        for (int i = 0; i < 10; i++) soma += Character.digit(cpf.charAt(i), 10) * (11 - i);
        int d2 = 11 - soma % 11;
        if (d2 >= 10) d2 = 0;
        return d1 == Character.digit(cpf.charAt(9), 10) && d2 == Character.digit(cpf.charAt(10), 10);
    }

    private boolean validarCnpj(String cnpj) {
        if (cnpj.chars().distinct().count() == 1) return false;
        int[] pesos1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int[] pesos2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int d1 = digitoCnpj(cnpj, pesos1);
        int d2 = digitoCnpj(cnpj.substring(0, 12) + d1, pesos2);
        return d1 == Character.digit(cnpj.charAt(12), 10) && d2 == Character.digit(cnpj.charAt(13), 10);
    }

    private int digitoCnpj(String valor, int[] pesos) {
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) soma += Character.digit(valor.charAt(i), 10) * pesos[i];
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
