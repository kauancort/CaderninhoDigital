package com.InovaSkill.CaderninhoDigital.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class GmailEmailService implements EmailService {
    private final JavaMailSender mailSender;
    private final String remetente;

    public GmailEmailService(JavaMailSender mailSender, @Value("${spring.mail.username}") String remetente) {
        this.mailSender = mailSender;
        this.remetente = remetente;
    }

    @Override
    public void enviarCodigoRecuperacao(String destinatario, String nome, String codigo) {
        SimpleMailMessage mensagem = new SimpleMailMessage();
        mensagem.setFrom(remetente);
        mensagem.setTo(destinatario);
        mensagem.setSubject("Código de recuperação — Caderninho Digital");
        mensagem.setText("""
                Olá, %s.

                Recebemos uma solicitação para redefinir sua senha.

                Seu código de recuperação é: %s

                Esse código expira em 10 minutos.

                Se você não solicitou essa alteração, ignore este e-mail.
                """.formatted(nome, codigo));
        mailSender.send(mensagem);
    }
}
