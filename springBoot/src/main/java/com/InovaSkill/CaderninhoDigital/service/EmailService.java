package com.InovaSkill.CaderninhoDigital.service;

public interface EmailService {
    void enviarCodigoRecuperacao(String destinatario, String nome, String codigo);
}
