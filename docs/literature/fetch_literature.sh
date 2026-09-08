#!/usr/bin/env bash
# Download the open-access literature for vigil into this folder.
# Run on a machine with normal internet access:  bash fetch_literature.sh
set -u
cd "$(dirname "$0")"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
ok=0; fail=0; failed=()

grab() {  # grab <filename> <url> [min_bytes]
  local out="$1" url="$2" min="${3:-20000}"
  if [ -s "$out" ]; then echo "  skip (exists) $out"; ok=$((ok+1)); return; fi
  echo "  → $out"
  if curl -sSL -A "$UA" --max-time 120 -o "$out" "$url" && [ "$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")" -ge "$min" ]; then
    ok=$((ok+1))
  else
    rm -f "$out"; fail=$((fail+1)); failed+=("$out  <-  $url")
  fi
}

echo "== Open-access PDFs =="
grab P3_Paral2023_Polymers_HighSpeedVPP_Review.pdf        "https://www.mdpi.com/2073-4360/15/12/2716/pdf"
grab D3_Paraskevoudis2020_Processes_Stringing.pdf         "https://www.mdpi.com/2227-9717/8/11/1464/pdf"
grab D4_Baumann2016_MATEC_VisionErrorDetection.pdf        "https://www.matec-conferences.org/articles/matecconf/pdf/2016/22/matecconf_icfst2016_06003.pdf"
grab D5_Brion2022_NatCommun_MultiHeadErrorDetection.pdf   "https://www.nature.com/articles/s41467-022-31985-y.pdf"
grab D6_euspen2017_InlineFailureDetection.pdf             "https://www.euspen.eu/knowledge-base/AM17133.pdf"
grab D7_AppliedSci2022_FDM_InProcessQuality_DL.pdf        "https://www.mdpi.com/2076-3417/12/17/8753/pdf"
# Possibly OA (Taylor & Francis "Full article" page) — try, ignore if it fails
grab P6_VPP2025_NovelVatDesign_SeparationForce.pdf        "https://www.tandfonline.com/doi/pdf/10.1080/17452759.2025.2470920"

echo "== Vendor troubleshooting guides (HTML snapshots) =="
grab F1_Formlabs_DiagnosingPrintFailure.html   "https://formlabs.com/support/Diagnosing-a-print-failure/" 5000
grab R1_Raise3D_ResinFailures20.html           "https://www.raise3d.com/blog/resin-3d-printing-failures-troubleshooting/" 5000
grab R2_3Dresyns_Troubleshooting.html          "https://www.3dresyns.com/pages/troubleshooting-resin-3d-printing-failures" 5000

echo
echo "== Done: $ok ok, $fail failed =="
for f in "${failed[@]:-}"; do [ -n "$f" ] && echo "  FAILED: $f"; done

cat <<'EOF'

== Paywalled — open these with an institutional login, or request from the authors ==
  P1  https://doi.org/10.1108/RPJ-12-2015-0188          Ye et al. 2017, separation force (RPJ)
  P2  https://doi.org/10.1016/j.cad.2015.05.021         Liravi et al. 2015, cohesive element model (CAD)
  P4  https://doi.org/10.1126/science.aaa2397           Tumbleston et al. 2015, CLIP (Science)
  P5  https://doi.org/10.1021/acsapm.5c00167            Interface flexibility & separation force, LCD VPP (2025)
  M1  https://asmedigitalcollection.asme.org/MSEC/proceedings-abstract/MSEC2022/85802/V001T01A030/1146933
                                                        Mao & Shan 2022, Smart Resin Vat (ASME MSEC)
  M2  https://www.sciencedirect.com/science/article/abs/pii/S2214860424000472   interferometric monitoring (AM 2024)
  M3  https://www.sciencedirect.com/science/article/abs/pii/S2214860422002020   ultrasonic monitoring (AM 2022)
  M4  https://www.sciencedirect.com/science/article/abs/pii/S2214860423005602   visual-guided in-situ repair (AM 2023)
  D1  https://doi.org/10.1016/j.addma.2020.101473       Petsiuk & Pearce 2020 (author copy: https://www.appropedia.org/Open_Source_Computer_Vision-based_Layer-wise_3D_Printing_Analysis)
  D2  https://doi.org/10.1007/s00170-020-06201-0        Jin, Zhang, Gu 2020, CNN failure detection (IJAMT)
EOF
