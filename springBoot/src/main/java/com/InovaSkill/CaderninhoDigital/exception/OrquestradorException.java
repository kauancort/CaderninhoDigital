package com.InovaSkill.CaderninhoDigital.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class OrquestradorException extends RuntimeException {
    private final CodigoErroOrquestrador codigo;
    private final HttpStatus status;

    public OrquestradorException(CodigoErroOrquestrador codigo, HttpStatus status, String message) {
        super(message);
        this.codigo = codigo;
        this.status = status;
    }
}
