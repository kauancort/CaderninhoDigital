package com.InovaSkill.CaderninhoDigital.enums;

/*
 * NAO_APLICAVEL        -> venda com retirada no local, não passa por despacho
 * AGUARDANDO_DESPACHO  -> venda com entrega (própria ou transportadora)
 *                          ainda não foi despachada/saiu para entrega
 * DESPACHADO           -> saiu para entrega / foi postado na transportadora;
 *                          é a partir daqui que o código de rastreamento
 *                          passa a fazer sentido ser informado
 * ENTREGUE             -> confirmação de que chegou ao cliente
 */
public enum SituacaoDespacho {
    NAO_APLICAVEL,
    AGUARDANDO_DESPACHO,
    DESPACHADO,
    ENTREGUE
}