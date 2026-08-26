package com.InovaSkill.CaderninhoDigital.legacy;

import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class LegacyHtmlTableParser {

    private static final Pattern ROW_PATTERN = Pattern.compile(
            "<tr\\b[^>]*>(.*?)</tr\\s*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern CELL_PATTERN = Pattern.compile(
            "<t[dh]\\b[^>]*>(.*?)</t[dh]\\s*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]+>", Pattern.DOTALL);
    private static final Pattern ENTITY_PATTERN = Pattern.compile("&(#x?[0-9a-f]+|[a-z]+);", Pattern.CASE_INSENSITIVE);
    private static final Charset WINDOWS_1252 = Charset.forName("windows-1252");

    public LegacyTable parse(String fileName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("O arquivo legado está vazio.");
        }

        String html = decode(bytes);
        Matcher rowMatcher = ROW_PATTERN.matcher(html);
        List<List<String>> parsedRows = new ArrayList<>();
        while (rowMatcher.find()) {
            Matcher cellMatcher = CELL_PATTERN.matcher(rowMatcher.group(1));
            List<String> cells = new ArrayList<>();
            while (cellMatcher.find()) {
                cells.add(cleanCell(cellMatcher.group(1)));
            }
            if (!cells.isEmpty()) {
                parsedRows.add(cells);
            }
        }

        if (parsedRows.size() < 1) {
            throw new BusinessException("O arquivo " + fileName + " não contém uma tabela reconhecível.");
        }

        List<String> headers = parsedRows.getFirst();
        if (headers.stream().allMatch(String::isBlank)) {
            throw new BusinessException("O arquivo " + fileName + " não possui cabeçalho válido.");
        }

        List<List<String>> rows = parsedRows.subList(1, parsedRows.size()).stream()
                .map(row -> normalizeRow(row, headers.size()))
                .toList();
        return new LegacyTable(fileName, headers, rows);
    }

    private String decode(byte[] bytes) {
        if (startsWithUtf8Bom(bytes)) {
            return new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        }
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ignored) {
            return new String(bytes, WINDOWS_1252);
        }
    }

    private List<String> normalizeRow(List<String> row, int size) {
        List<String> normalized = new ArrayList<>(row);
        while (normalized.size() < size) {
            normalized.add("");
        }
        if (normalized.size() > size) {
            return List.copyOf(normalized.subList(0, size));
        }
        return List.copyOf(normalized);
    }

    private String cleanCell(String value) {
        String withoutTags = TAG_PATTERN.matcher(value).replaceAll("");
        String decoded = ENTITY_PATTERN.matcher(withoutTags).replaceAll(this::decodeEntity);
        return decoded.replace('\u00a0', ' ').trim();
    }

    private String decodeEntity(MatchResult matcher) {
        String entity = matcher.group(1);
        if (entity.equalsIgnoreCase("nbsp")) return " ";
        if (entity.equalsIgnoreCase("amp")) return "&";
        if (entity.equalsIgnoreCase("quot")) return "\"";
        if (entity.equalsIgnoreCase("apos")) return "'";
        if (entity.equalsIgnoreCase("lt")) return "<";
        if (entity.equalsIgnoreCase("gt")) return ">";
        try {
            int radix = entity.startsWith("#x") || entity.startsWith("#X") ? 16 : 10;
            String number = entity.substring(entity.startsWith("#x") || entity.startsWith("#X") ? 2 : 1);
            return String.valueOf(Character.toChars(Integer.parseInt(number, radix)));
        } catch (RuntimeException ignored) {
            return matcher.group();
        }
    }

    private boolean startsWithUtf8Bom(byte[] bytes) {
        return bytes.length >= 3
                && (bytes[0] & 0xff) == 0xef
                && (bytes[1] & 0xff) == 0xbb
                && (bytes[2] & 0xff) == 0xbf;
    }
}
