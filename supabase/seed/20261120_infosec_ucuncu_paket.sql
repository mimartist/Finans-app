-- ============================================================================
-- İNFOSEC — 9 KASIM 2026 FATURA/BAKİYE TABLOSUNA GÖRE GÜNCELLEME
--
-- Kaynak: INFOSEC_Fatura_ve_Bakiye_09.11.2026.xlsx (iç tutarlılığı doğrulandı)
--
--   İş paketi                        Anlaşma(dahil)  Tahsil      Kalan
--   Mimari hizmet                        780.000,00  390.000,00  390.000,00
--   Tadilat (inşaat/elektrik/mekanik)  1.328.947,27  797.068,00  531.879,27
--   Aydınlatma/cam/zemin/perde         2.425.987,01 1.455.592,20 970.394,81
--   TOPLAM                             4.534.934,28 2.642.660,20 1.892.274,08
--
-- Bu dosya:
--   1. Tadilat tutarını 8 Kasım kapsamına göre düzeltir (+500,60)
--   2. Tahsilat tarihlerini faturalarla eşleştirir (7 Ekim / 16 Ekim)
--   3. ÜÇÜNCÜ PAKETİ ekler — proje, alacak ve 3 Kasım tahsilatı
--
-- GİRİLMEYEN: üçüncü paketin maliyeti bilinmiyor, kâr hesaplanamaz.
-- Kalan 1.892.274,08'in vadesi teslim/fatura koşullarına bağlı; tablo
-- "vadesi geçmiş borç değildir" diyor, bu yüzden vade boş bırakıldı.
-- ============================================================================

do $$
declare
  owner uuid; d_tad bigint; d_mim bigint; d_uc bigint; p_uc bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. TADİLAT — 8 Kasım kapsamı ─────────────────────────────────────────
  select id into d_tad from debt_records
   where person_name = 'İnfosec' and description = 'Tadilat Faz 1 — kalan %40'
     and is_settled is false limit 1;
  if d_tad is not null then
    update debt_records
       set amount = 531879.27, total_amount = 1328947.27, paid_amount = 797068,
           notes = 'Toplam 1.328.947,27 KDV dahil · 8 Kasım kapsamı · %60 avans tahsil edildi'
     where id = d_tad;
    update debt_transactions set transaction_date = '2026-10-16',
           notes = 'Fatura GIB2026000000004 · tadilat avansı'
     where debt_id = d_tad and amount = 797068 and type = 'tahsilat';
  end if;
  update projects set contract_amount = 1107456.06,
         notes = 'Toplam 1.328.947,27 KDV dahil · 8 Kasım kapsamı · %60 avans alındı'
   where name = 'İnfosec Tadilat Faz 1';

  -- ── 2. MİMARİ — tahsilat tarihi ──────────────────────────────────────────
  select id into d_mim from debt_records
   where person_name = 'İnfosec' and description = 'Mimari Proje — kalan %50'
     and is_settled is false limit 1;
  if d_mim is not null then
    update debt_transactions set transaction_date = '2026-10-07',
           notes = 'Fatura GIB2026000000003 · %50 peşin'
     where debt_id = d_mim and amount = 390000 and type = 'tahsilat';
  end if;

  -- ── 3. ÜÇÜNCÜ PAKET ──────────────────────────────────────────────────────
  select id into p_uc from projects where name = 'İnfosec Aydınlatma/Cam/Zemin/Perde';
  if p_uc is null then
    insert into projects (name, client, contract_amount, vat_rate, collected,
                          status, start_date, notes, user_id)
    values ('İnfosec Aydınlatma/Cam/Zemin/Perde', 'İnfosec', 2021655.84, 20, 1455592.20,
            'devam', '2026-11-03',
            'Aydınlatma 266.400 · cam/bölme 376.240 · halı-zemin 462.015,84 · Somfy perde 917.000 (KDV hariç) · zemin 8.268 EUR kur riski', owner)
    returning id into p_uc;
  end if;

  select id into d_uc from debt_records
   where person_name = 'İnfosec' and description = 'Aydınlatma/cam/zemin/perde — kalan' limit 1;
  if d_uc is null then
    insert into debt_records (person_name, type, amount, currency, description,
                              transaction_date, due_date, is_settled, vat_rate,
                              total_amount, paid_amount, project_id, notes, user_id)
    values ('İnfosec', 'alacak', 970394.81, 'TRY', 'Aydınlatma/cam/zemin/perde — kalan',
            '2026-11-03', null, false, 20, 2425987.01, 1455592.20, p_uc,
            'Vade teslim/fatura koşullarına bağlı · zemin kalemi EUR kuruna duyarlı', owner)
    returning id into d_uc;

    insert into debt_transactions (debt_id, type, amount, currency,
                                   transaction_date, notes, user_id)
    values (d_uc, 'tahsilat', 1455592.20, 'TRY', '2026-11-03',
            'Fatura GIB2026000000005 · ikinci avans, dört iş grubu', owner);
  end if;
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select description, amount, total_amount, paid_amount, due_date
--   from debt_records where person_name = 'İnfosec' and is_settled is false;
-- select t.transaction_date, t.amount, t.notes from debt_transactions t
--   join debt_records d on d.id = t.debt_id where d.person_name = 'İnfosec'
--  order by t.transaction_date;
