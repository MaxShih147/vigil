# vigil 文獻庫

對應 `docs/vigil-failure-modes.pdf` 與研究規劃討論中的引用代號。
`fetch_literature.sh` 會把**開放取用（OA）**的 PDF 抓進這個資料夾；
付費牆的用 DOI 連結透過公司 / 學校帳號取得，或向作者索取。

執行方式（在 Mac 上）：

```bash
cd docs/literature
bash fetch_literature.sh
```

## 下載狀態（2026-09-05 執行 fetch_literature.sh）

已在資料夾：D5、D6、F1、R1、R2。
腳本抓不到（出版社擋 curl，瀏覽器開連結另存即可）：

- P3 → https://www.mdpi.com/2073-4360/15/12/2716/pdf （備用：https://europepmc.org/articles/PMC10302688?pdf=render）
- D3 → https://www.mdpi.com/2227-9717/8/11/1464/pdf
- D7 → https://www.mdpi.com/2076-3417/12/17/8753/pdf
- D4 → https://www.matec-conferences.org/articles/matecconf/pdf/2016/22/matecconf_icfst2016_06003.pdf
- P6 → https://www.tandfonline.com/doi/pdf/10.1080/17452759.2025.2470920 （可能非 OA）

## A. 開放取用 —— 腳本自動下載

| 代號 | 檔名 | 文獻 | 與專案的關係 |
|---|---|---|---|
| P3 | `P3_Paral2023_Polymers_HighSpeedVPP_Review.pdf` | Paral S.K., Lin D.-Z., Cheng Y.-L., Lin S.-C., Jeng J.-Y. (2023). A Review of Critical Issues in High-Speed Vat Photopolymerization. *Polymers* 15(12):2716. doi:10.3390/polym15122716 | 台科大鄭正元團隊；LCD 機型分離力 / 回流 / 照度不均的綜述，失敗根因入門 |
| D3 | `D3_Paraskevoudis2020_Processes_Stringing.pdf` | Paraskevoudis K., Karayannis P., Koumoulos E.P. (2020). Real-Time 3D Printing Remote Defect Detection (Stringing) with Computer Vision and AI. *Processes* 8(11):1464. doi:10.3390/pr8111464 | FDM 遠端視覺監測架構 |
| D4 | `D4_Baumann2016_MATEC_VisionErrorDetection.pdf` | Baumann F., Roller D. (2016). Vision based error detection for 3D printing processes. *MATEC Web Conf.* 59:06003. doi:10.1051/matecconf/20165906003 | 早期**規則式**（非學習）FDM 視覺偵測：脫板、變形、缺料；與幾何優先路線同宗 |
| D5 | `D5_Brion2022_NatCommun_MultiHeadErrorDetection.pdf` | Brion D.A.J., Pattinson S.W. (2022). Generalisable 3D printing error detection and correction via multi-head neural networks. *Nature Communications* 13:4654. doi:10.1038/s41467-022-31985-y | 學習式的天花板代表（Cambridge）；跨印表機泛化的對照組 |
| D6 | `D6_euspen2017_InlineFailureDetection.pdf` | In-line 3D print failure detection using computer vision. *euspen* AM17133 (2017/2019). | 短篇，早期 in-line 視覺失敗偵測 |
| D7 | `D7_AppliedSci2022_FDM_InProcessQuality_DL.pdf` | Design of an In-Process Quality Monitoring Strategy for FDM-Type 3D Printer Using Deep Learning. *Applied Sciences* 12(17):8753 (2022). doi:10.3390/app12178753 | FDM 深度學習監測範例 |
| F1 | `F1_Formlabs_DiagnosingPrintFailure.html` | Formlabs. Diagnosing a print failure (SLA). | 最有系統的廠商失敗分類（raft silhouetting、non-adherence、delamination、cupping blowout…） |
| R1 | `R1_Raise3D_ResinFailures20.html` | Raise3D. Resin 3D Printing Failures & Troubleshooting: 20 Problems. | 20 類含根因與症狀 |
| R2 | `R2_3Dresyns_Troubleshooting.html` | 3Dresyns. Troubleshooting Resin 3D Printing Failures. | 樹脂配方角度 |

## B. 付費牆 —— 需要機構帳號或向作者索取

| 代號 | 文獻 | DOI / 連結 | 與專案的關係 |
|---|---|---|---|
| P1 | Ye H., Venketeswaran A., Das S., Zhou C. (2017). Study of separation force in constrained surface projection stereolithography. *Rapid Prototyping Journal* 23(2):353–361. | [10.1108/RPJ-12-2015-0188](https://doi.org/10.1108/RPJ-12-2015-0188) | 分離力 vs 截面積 / 抬升速度 / 層厚的實測；誘發協定的定量依據 |
| P2 | Liravi F., Das S., Zhou C. (2015). Separation force analysis and prediction based on cohesive element model for constrained-surface stereolithography processes. *Computer-Aided Design* 69:134–142. | [10.1016/j.cad.2015.05.021](https://doi.org/10.1016/j.cad.2015.05.021) | cohesive zone model 預測分離力；可從切片截面預估高風險層（L3 延伸） |
| P4 | Tumbleston J.R. et al. (2015). Continuous liquid interface production of 3D objects. *Science* 347(6228):1349–1352. | [10.1126/science.aaa2397](https://doi.org/10.1126/science.aaa2397) | CLIP：消除分離力的反證，說明分離力是脫板主因 |
| P5 | Impact of Interface Flexibility on Separation Force in LCD Vat Photopolymerization. *ACS Applied Polymer Materials* (2025). | [10.1021/acsapm.5c00167](https://doi.org/10.1021/acsapm.5c00167) | 最新的 LCD 機型分離力研究 |
| P6 | Novel vat design for LCD vat photopolymerization: reduction of separation force and pixelated effect. *Virtual and Physical Prototyping* (2025). | [10.1080/17452759.2025.2470920](https://doi.org/10.1080/17452759.2025.2470920) | 同上（可能為 OA，腳本會嘗試） |
| M1 | Mao H., Shan Y. (2022). Smart Resin Vat: Real-Time Detecting Failures, Defects, and Curing Area in Vat Photopolymerization 3D Printing. *ASME MSEC 2022*, V001T01A030. | [ASME](https://asmedigitalcollection.asme.org/MSEC/proceedings-abstract/MSEC2022/85802/V001T01A030/1146933) · [Purdue 技轉頁](https://licensing.prf.org/product/smart-resin-vat-real-time-detecting-failures-defects-and-curing-area-in-vat-photopolymerization-3d-printing/print) | **最接近的先行研究**：槽內熱敏電阻陣列 + ML；侵入式對照基線 |
| M2 | In-situ interferometric curing monitoring for DLP vat photopolymerization. *Additive Manufacturing* (2024). | [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S2214860424000472) | 原位固化監測（精密量測路線） |
| M3 | In-situ ultrasonic monitoring for vat photopolymerization. *Additive Manufacturing* (2022). | [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S2214860422002020) | 同上 |
| M4 | Limiting defect in vat photopolymerization via visual-guided in-situ repair. *Additive Manufacturing* (2023). | [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S2214860423005602) | 唯一機內視覺的；目的是修補非中止 |
| D1 | Petsiuk A., Pearce J.M. (2020). Open source computer vision-based layer-wise 3D printing analysis. *Additive Manufacturing* 36:101473. | [10.1016/j.addma.2020.101473](https://doi.org/10.1016/j.addma.2020.101473) · [Appropedia（作者自存版）](https://www.appropedia.org/Open_Source_Computer_Vision-based_Layer-wise_3D_Printing_Analysis) | 逐層影像與 G-code 預期比對，概念上最接近 L3 |
| D2 | Jin Z., Zhang Z., Gu G.X. (2020). Image-based failure detection for material extrusion process using a convolutional neural network. *Int. J. Adv. Manuf. Technol.* | [10.1007/s00170-020-06201-0](https://doi.org/10.1007/s00170-020-06201-0) | 學習式基線 |

## C. 尚未取得、值得再找的

- Pan Y., Zhou C., Chen Y. 系列（2012–2017）constrained-surface SLA 分離力與杯吸分析（*J. Manuf. Sci. Eng.*）—— P4 引用的原始來源
- Gritsenko et al. (2018) 分離力與樹脂回填特性
- Purdue Mao 團隊後續期刊版（MSEC 會議版之後可能有 *J. Manuf. Processes* 擴充版）
- 任何「LCD 壞點 / 光源均勻性」對缺件影響的量化研究 —— 目前只有廠商指南

## 引用格式

`vigil.bib` 內含全部條目，代號即 BibTeX key。
