// URL pública do projeto Versatille Eventos
// A Publishable key é pública e pode ser usada no navegador.
// NUNCA coloque aqui uma Secret key/service_role.
window.SUPABASE_CONFIG = {
  url: "https://iushyeftqcuwkmxvgqtt.supabase.co",
  anonKey: localStorage.getItem("versatille_publishable_key") || ""
};