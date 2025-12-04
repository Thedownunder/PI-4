// src/services/patientService.ts
import { supabase } from "./supabaseClient";
import type { Patient } from "../store/board";

/**
 * Busca todos os pacientes cadastrados.
 * Mapeia os dados do Supabase para o tipo Patient da aplicação.
 */
export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pacientes:", error);
    throw error;
  }

  // Mapeamento para satisfazer o tipo Patient definido no store
  const mappedPatients: Patient[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    contact: row.phone, // Mapeia 'phone' (BD) para 'contact' (Front)
    replacements: [],   // Inicializa array vazio (será preenchido pelo Realtime do Board)
    mainProfessional: undefined,
  }));

  return mappedPatients;
}

/**
 * Cria um novo paciente na tabela patients.
 */
export async function createPatient(input: {
  name: string;
  phone?: string;
}): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert({
      name: input.name,
      phone: input.phone ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao criar paciente:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    contact: data.phone,
    replacements: [],
    mainProfessional: undefined,
  };
}