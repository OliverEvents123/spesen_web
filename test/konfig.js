// konfig.js — TESTFASSUNG
// Welche Supabase-Datenbank test/ benutzt. Eigenes Testprojekt "Spesentool-Test".
// Die Live-Datenbank wird von hier aus nie berührt.
// Die echte App hat ihre eigene konfig.js eine Ebene höher. Beim Übernehmen
// von test/ nach oben diese Datei NICHT mitkopieren.
//
// Der publishable Key darf öffentlich sein; was er darf, entscheidet die
// Row Level Security. Der service_role-Schlüssel gehört nie hierher.

const SUPABASE_URL = "https://jqegbngpuflymvpuvvvf.supabase.co";
const SUPABASE_KEY = "sb_publishable_lRw5GIs8fW-bkBeKeBT6Ww_5BsxFKGD";
