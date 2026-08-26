package com.InovaSkill.CaderninhoDigital.legacy;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public record LegacyTable(
        String fileName,
        List<String> headers,
        List<List<String>> rows
) {

    public LegacyTable {
        fileName = Objects.requireNonNull(fileName, "fileName");
        headers = headers == null ? List.of() : headers.stream().map(LegacyTable::normalizar).toList();
        rows = rows == null
                ? List.of()
                : rows.stream().map(row -> row == null ? List.<String>of() : List.copyOf(row)).toList();
    }

    public String value(List<String> row, String header) {
        if (row == null || header == null) {
            return "";
        }
        int index = indexOf(header);
        if (index < 0 || index >= row.size() || row.get(index) == null) {
            return "";
        }
        return row.get(index).trim();
    }

    public int indexOf(String header) {
        if (header == null) {
            return -1;
        }
        String normalized = normalizar(header);
        for (int index = 0; index < headers.size(); index++) {
            if (headers.get(index).equals(normalized)) {
                return index;
            }
        }
        return -1;
    }

    public boolean hasHeader(String header) {
        return indexOf(header) >= 0;
    }

    public String firstAvailableValue(List<String> row, String... possibleHeaders) {
        for (String header : possibleHeaders) {
            if (hasHeader(header)) {
                String value = value(row, header);
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return "";
    }

    public Map<String, Integer> headerIndexes() {
        Map<String, Integer> indexes = new HashMap<>();
        for (int index = 0; index < headers.size(); index++) {
            indexes.putIfAbsent(headers.get(index), index);
        }
        return Map.copyOf(indexes);
    }

    private static String normalizar(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
