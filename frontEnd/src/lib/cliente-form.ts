export type ClienteFormData = {
  nome: string;
  telefone: string;
  email: string;
  documento: string;
  inscricaoEstadual: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  // Transportadora vinculada ao cliente
  usaTransportadora: boolean;
  transportadoraNome: string;
  transportadoraCnpj: string;
  transportadoraTelefone: string;
  transportadoraEmail: string;
  transportadoraCep: string;
  transportadoraEndereco: string;
  transportadoraNumero: string;
  transportadoraComplemento: string;
  transportadoraBairro: string;
  transportadoraCidade: string;
  transportadoraEstado: string;
  transportadoraObservacao: string;
  tipo?: "CLIENTE" | "TRANSPORTADORA" | "LOJISTA";
};

export const clienteFormVazio: ClienteFormData = {
  nome: "",
  telefone: "",
  email: "",
  documento: "",
  inscricaoEstadual: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  usaTransportadora: false,
  transportadoraNome: "",
  transportadoraCnpj: "",
  transportadoraTelefone: "",
  transportadoraEmail: "",
  transportadoraCep: "",
  transportadoraEndereco: "",
  transportadoraNumero: "",
  transportadoraComplemento: "",
  transportadoraBairro: "",
  transportadoraCidade: "",
  transportadoraEstado: "",
  transportadoraObservacao: "",
  tipo: "CLIENTE",
};

export const UFS_BRASIL = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;
