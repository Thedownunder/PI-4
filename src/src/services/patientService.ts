// src/services/patientService.ts
import { supabase } from "./supabaseClient";
import type { Patient } from "../store/board";

/**
 * Busca todos os pacientes cadastrados.
 * Ajuste o select se o tipo Patient tiver campos diferentes.
 */
export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*") // ou selecione campos específicos: "id, name, phone"
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar pacientes:", error);
    throw error;
  }

  return (data ?? []) as Patient[];
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

  return data as Patient;
}
