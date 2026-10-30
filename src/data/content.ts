export const concepts = [
  {
    term: "Liquidez corriente",
    category: "Contabilidad e indicadores",
    definition:
      "Mide cuántos pesos de activos corrientes respaldan cada peso de deuda exigible en el corto plazo.",
    formula: "Activo corriente / Pasivo corriente",
    example: "$1.500.000 / $1.000.000 = 1,5",
    caution:
      "No evalúa la calidad ni la velocidad de realización de los activos.",
  },
  {
    term: "Endeudamiento",
    category: "Finanzas empresariales",
    definition:
      "Indica qué proporción de los activos se financia con obligaciones de terceros.",
    formula: "Pasivo total / Activo total × 100",
    example: "$4.000.000 / $10.000.000 = 40%",
    caution:
      "Debe compararse con empresas del mismo sector y con períodos anteriores.",
  },
  {
    term: "TNA",
    category: "Créditos y financiamiento",
    definition:
      "La Tasa Nominal Anual expresa una tasa anual que no incorpora por sí sola la capitalización.",
    formula: "Tasa periódica × cantidad de períodos del año",
    example: "2% mensual × 12 = 24% TNA",
    caution: "No equivale a la TEA ni incluye comisiones como el CFT.",
  },
  {
    term: "TEA",
    category: "Créditos y financiamiento",
    definition:
      "La Tasa Efectiva Anual refleja el efecto de capitalizar intereses durante un año.",
    formula: "(1 + tasa periódica)^períodos − 1",
    example: "(1 + 2%)¹² − 1 = 26,82%",
    caution: "Debe compararse usando igual moneda y período.",
  },
  {
    term: "CFT",
    category: "Créditos y financiamiento",
    definition:
      "El Costo Financiero Total busca reunir intereses, comisiones, seguros e impuestos aplicables.",
    formula: "Tasa interna del flujo completo del préstamo",
    example: "Incluye cuota, gastos de otorgamiento y cargos obligatorios.",
    caution: "No puede calcularse con precisión si faltan cargos o impuestos.",
  },
  {
    term: "VAN",
    category: "Inversiones",
    definition:
      "Estima cuánto valor agrega un proyecto al descontar sus flujos a una tasa elegida.",
    formula: "Σ Flujoₜ / (1 + tasa)ᵗ − Inversión inicial",
    example: "Un VAN de $250.000 supera en ese monto el rendimiento requerido.",
    caution: "Depende fuertemente de los flujos y la tasa de descuento estimados.",
  },
  {
    term: "TIR",
    category: "Inversiones",
    definition:
      "Es la tasa que hace que el VAN del proyecto sea igual a cero.",
    formula: "0 = Σ Flujoₜ / (1 + TIR)ᵗ − Inversión",
    example: "Una TIR del 28% puede compararse con el rendimiento requerido.",
    caution: "Flujos con cambios de signo pueden producir múltiples soluciones.",
  },
  {
    term: "Payback",
    category: "Inversiones",
    definition:
      "Indica cuánto tiempo demanda recuperar nominalmente la inversión inicial.",
    formula: "Períodos completos + saldo pendiente / flujo siguiente",
    example: "2,4 años para recuperar la inversión.",
    caution: "El payback simple no considera el valor tiempo del dinero.",
  },
  {
    term: "Análisis de sensibilidad",
    category: "Riesgos y escenarios",
    definition:
      "Explora cómo cambian los resultados al modificar supuestos clave.",
    formula: "Resultado modificado − resultado base",
    example: "Medir el margen si las ventas caen 10%.",
    caution: "Es una simulación, no una predicción garantizada.",
  },
];
