/**
 * scripts/demo/lib/mexico-tax-counsel-memo.ts
 *
 * Mexican Tax Architecture Review & Billing Decision Engine.
 * Formally documents tax counsel legal opinion, resolution of Pilot #6
 * rejections, billing decision matrix, and the economic gate for native CFDI.
 */

export interface TaxCounselReviewSummary {
  reviewStatus: "COMPLETE";
  counselFirm: string;
  leadCounsel: string;
  dateOfOpinion: string;
  sellerEntity: {
    legalName: string;
    jurisdiction: string;
    taxResidence: string;
    taxIdentifier: string;
    permanentEstablishmentInMexico: false;
  };
  digitalServicesClassification: string;
  mexicoRfcRegistration: {
    required: "CONDITIONAL";
    legalBasis: string;
    regimeName: string;
    createsPermanentEstablishment: false;
  };
  vatModel: {
    applicableRate: number; // 0.16
    separateItemizationRequired: true;
    legalBasis: string;
    b2bTreatment: string;
  };
  foreignReceiptStatus: {
    reviewedTemplate: "foreign_fiscal_receipt_v2_approved";
    legallyCompliant: true;
    applicableRule: string;
  };
  cfdiStatutoryRequirement: {
    legallyRequiredFromDeskcomm: false;
    explanation: string;
  };
}

export interface RejectionResolution {
  rejectionCategory: string;
  dealCount: number;
  blockedMrrMxn: number;
  rootCauseDiagnosis: string;
  resolutionStrategy: string;
  recoverableWithTaxMemo: boolean;
  alternativeRequirement: string;
}

export interface EconomicGateCfdi {
  mrrBlockedSpecificallyByCfdiMxn: number;
  mrrBlockedSpecificallyByCfdiUsd: number;
  estimatedSetupCostUsd: number;
  estimatedMonthlyOperatingCostUsd: number;
  economicBreakevenMrrMxn: number;
  decision: "DO NOT PROCEED / DEFER";
  rationale: string;
}

export function getMexicoTaxCounselReview(): TaxCounselReviewSummary {
  return {
    reviewStatus: "COMPLETE",
    counselFirm: "González & Asoc. Consultores Fiscales S.C. (CDMX)",
    leadCounsel: "Lic. Roberto González M. (C.P. / Abogado Fiscalista)",
    dateOfOpinion: "2026-09-16",
    sellerEntity: {
      legalName: "Deskcomm Technologies Inc.",
      jurisdiction: "Delaware, United States",
      taxResidence: "United States",
      taxIdentifier: "EIN-84-3920194",
      permanentEstablishmentInMexico: false,
    },
    digitalServicesClassification:
      "Servicios digitales de intermediación, software CRM y mensajería en la nube conforme al Artículo 18-B Fracción IV de la Ley del IVA.",
    mexicoRfcRegistration: {
      required: "CONDITIONAL",
      legalBasis: "Artículo 18-D de la Ley del Impuesto al Valor Agregado",
      regimeName: "Padrón de Prestadores de Servicios Digitales Residentes en el Extranjero (SAT)",
      createsPermanentEstablishment: false,
    },
    vatModel: {
      applicableRate: 0.16,
      separateItemizationRequired: true,
      legalBasis: "Artículos 18-B al 18-M de la Ley del IVA y Regla 12.1.4 de la RMF 2026",
      b2bTreatment:
        "Las clínicas dentales (personas físicas con actividad empresarial o personas morales) pueden acreditar el IVA y deducir el gasto siempre que el comprobante extranjero desglose expresamente el 16% de IVA y contenga su RFC.",
    },
    foreignReceiptStatus: {
      reviewedTemplate: "foreign_fiscal_receipt_v2_approved",
      legallyCompliant: true,
      applicableRule: "Regla 12.1.4 de la Resolución Miscelánea Fiscal (RMF 2026)",
    },
    cfdiStatutoryRequirement: {
      legallyRequiredFromDeskcomm: false,
      explanation:
        "Deskcomm, al no tener establecimiento permanente ni domicilio fiscal en territorio nacional, NO tiene la obligación ni la facultad de emitir CFDI 4.0 directamente ante el SAT. La exigencia de CFDI de ciertas clínicas proviene de hábitos contables locales o políticas internas de cuentas por pagar, no de una obligación legal del proveedor extranjero.",
    },
  };
}

export function getPilot6RejectionResolutions(): RejectionResolution[] {
  return [
    {
      rejectionCategory: "requires_actual_cfdi",
      dealCount: 2,
      blockedMrrMxn: 2680,
      rootCauseDiagnosis:
        "Clínica y contador habituados a exigir exclusivamente CFDI 4.0 con timbre SAT para cualquier gasto administrativo sin distinguir proveedores extranjeros de digitales.",
      resolutionStrategy:
        "Presentar paquete de orientación fiscal de la RMF Regla 12.1.4 con carta del asesor fiscal. Si la política interna es inquebrantable, canalizar a estructura MoR/revendedor.",
      recoverableWithTaxMemo: false,
      alternativeRequirement: "Merchant of Record (MoR) mexicano o revendedor local con capacidad CFDI.",
    },
    {
      rejectionCategory: "accountant_uncertainty",
      dealCount: 1,
      blockedMrrMxn: 1790,
      rootCauseDiagnosis:
        "El contador desconocía que un comprobante extranjero con RFC y desglose de IVA ampara deducción legítima conforme a la regla 12.1.4 de la RMF.",
      resolutionStrategy:
        "Entrega de la Guía Fiscal Deskcomm para Contadores Mexicanos respaldada por opinión fiscal. Validación exitosa con el despacho contable.",
      recoverableWithTaxMemo: true,
      alternativeRequirement: "Ninguna; la guía de educación fiscal desbloquea el acuerdo.",
    },
    {
      rejectionCategory: "foreign_supplier_not_accepted",
      dealCount: 1,
      blockedMrrMxn: 1790,
      rootCauseDiagnosis:
        "Política interna corporativa de la red clínica que prohíbe dar de alta en cuentas por pagar a proveedores extranjeros por requisitos de compliance.",
      resolutionStrategy:
        "No solucionable con el comprobante extranjero. Requiere facturación a través de un intermediario comercial registrado en México.",
      recoverableWithTaxMemo: false,
      alternativeRequirement: "Revendedor o Merchant of Record con razón social en México.",
    },
    {
      rejectionCategory: "legal_entity_requirement",
      dealCount: 1,
      blockedMrrMxn: 1790,
      rootCauseDiagnosis:
        "Clínica exige contrato comercial firmado con una Sociedad Anónima o S. de R.L. mexicana.",
      resolutionStrategy:
        "No es un problema de facturación técnica, sino de estructura legal del proveedor.",
      recoverableWithTaxMemo: false,
      alternativeRequirement: "Constitución de subsidiaria en México o revendedor nacional.",
    },
  ];
}

export function getEconomicGateEvaluation(): EconomicGateCfdi {
  const mrrBlockedCfdi = 2680; // MXN
  const mrrBlockedUsd = Math.round(mrrBlockedCfdi / 19.8); // ~135 USD
  return {
    mrrBlockedSpecificallyByCfdiMxn: mrrBlockedCfdi,
    mrrBlockedSpecificallyByCfdiUsd: mrrBlockedUsd,
    estimatedSetupCostUsd: 18500, // Constitución entidad, registro SAT, FIEL, PAC, asesoría legal
    estimatedMonthlyOperatingCostUsd: 1400, // Contabilidad local, declaraciones mensuales, PAC timbrado
    economicBreakevenMrrMxn: 280000, // ~14,000 USD/mes de MRR bloqueado para justificar inversión
    decision: "DO NOT PROCEED / DEFER",
    rationale:
      "Desarrollar una infraestructura nativa de CFDI 4.0 o constituir una entidad mexicana para recuperar $2,680 MXN/mes ($135 USD) es económicamente inviable (costo de setup de $18,500 USD + $1,400 USD/mes de operación). " +
      "La solución validada de comprobante fiscal extranjero unifica el 61.5% de clientes sensibles, y para el resto, un revendedor/MoR ofrece mejor balance costo/beneficio si el volumen escala.",
  };
}
