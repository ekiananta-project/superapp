(() => {
    "use strict";

    const KUNCI_DOMPET = "keuangan_dompet_v1";
    const KUNCI_AKUN = "keuangan_akun_v1";
    const KUNCI_TRANSAKSI = "keuangan_transaksi_v1";

    const elemenTeks = document.querySelector("[data-quote-teks]");
    const elemenEmoji = document.querySelector("[data-quote-emoji]");

    if (!elemenTeks || !elemenEmoji) return;

    function bacaJSON(kunci, fallback = []) {
        try {
            return JSON.parse(localStorage.getItem(kunci)) || fallback;
        } catch {
            return fallback;
        }
    }

    function pilihAcak(daftar) {
        return daftar[Math.floor(Math.random() * daftar.length)];
    }

    function bulanSama(tanggalA, tanggalB) {
        return (
            tanggalA.getMonth() === tanggalB.getMonth() &&
            tanggalA.getFullYear() === tanggalB.getFullYear()
        );
    }

    function parseTanggal(teksTanggal) {
        const [tahun, bulan, hari] = teksTanggal.split("-").map(Number);
        return new Date(tahun, bulan - 1, hari);
    }

    function buatQuote() {
        const dompet = bacaJSON(KUNCI_DOMPET);
        const akun = bacaJSON(KUNCI_AKUN);
        const transaksi = bacaJSON(KUNCI_TRANSAKSI);

        const saldoTotal = dompet.reduce(
            (total, item) => total + Number(item.saldo || 0),
            0
        );

        const sekarang = new Date();

        const transaksiBulanIni = transaksi.filter(item =>
            bulanSama(parseTanggal(item.tanggal), sekarang)
        );

        const pengeluaranBulanIni = transaksiBulanIni
            .filter(item => item.jenis === "pengeluaran")
            .reduce((total, item) => total + Number(item.jumlah || 0), 0);

        const pemasukanBulanIni = transaksiBulanIni
            .filter(item => item.jenis === "pemasukan")
            .reduce((total, item) => total + Number(item.jumlah || 0), 0);

        const kandidat = [];

        /* Tidak ada transaksi bulan ini */
        if (transaksiBulanIni.length === 0) {
            kandidat.push(
                {
                    teks: "Bulan ini masih sepi transaksi nih.",
                    emoji: "📝"
                },
                {
                    teks: "Belum ada jejak uang bulan ini.",
                    emoji: "👀"
                }
            );
        }

        /* Saldo mulai tipis */
        if (saldoTotal > 0 && saldoTotal < 500000) {
            kandidat.push(
                {
                    teks: "Dompet mulai tipis, kita jaga ritme ya.",
                    emoji: "🥲"
                }
            );
        }

        /* Pengeluaran lebih besar */
        if (
            pengeluaranBulanIni > 0 &&
            pengeluaranBulanIni > pemasukanBulanIni
        ) {
            kandidat.push(
                {
                    teks: "Pengeluaran lagi unggul bulan ini nih.",
                    emoji: "👀"
                },
                {
                    teks: "Hayoo, bulan ini duitnya lari ke mana aja?",
                    emoji: "💸"
                }
            );
        }

        /* Pemasukan lebih besar */
        if (
            pemasukanBulanIni > 0 &&
            pemasukanBulanIni > pengeluaranBulanIni
        ) {
            kandidat.push(
                {
                    teks: "Wih, pemasukan lagi menang bulan ini.",
                    emoji: "😎"
                },
                {
                    teks: "Ada yang masuk nih, mantap.",
                    emoji: "💰"
                }
            );
        }

        /* Cari akun pengeluaran terbesar bulan ini */
        const totalPerAkun = {};

        transaksiBulanIni
            .filter(item => item.jenis === "pengeluaran")
            .forEach(item => {
                totalPerAkun[item.akunId] =
                    (totalPerAkun[item.akunId] || 0) +
                    Number(item.jumlah || 0);
            });

        const akunTerbesarId = Object.entries(totalPerAkun)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        if (akunTerbesarId) {
            const akunTerbesar = akun.find(item => item.id === akunTerbesarId);

            if (akunTerbesar) {
                kandidat.push({
                    teks: `Paling banyak larinya ke ${akunTerbesar.nama} nih.`,
                    emoji: "👀"
                });
            }
        }

        /* Fallback agar quote tetap terasa hidup */
        if (kandidat.length === 0) {
            kandidat.push(
                {
                    teks: "Hayo, bulan ini uangnya ke mana aja?",
                    emoji: "👀"
                },
                {
                    teks: "Masih aman sampai akhir bulan?",
                    emoji: "😏"
                },
                {
                    teks: "Sedikit-sedikit tetap dicatat ya.",
                    emoji: "✍️"
                },
                {
                    teks: "Cek sebentar, siapa tahu ada yang kelewat.",
                    emoji: "🔎"
                }
            );
        }

        return pilihAcak(kandidat);
    }

    function renderQuote() {
        const quote = buatQuote();

        elemenTeks.textContent = quote.teks;
        elemenEmoji.textContent = quote.emoji;
    }

    renderQuote();
})();
