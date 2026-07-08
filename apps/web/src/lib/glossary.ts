/**
 * 용어 사전 (목업 v4 이식, solar-742). O&M 실무자 눈높이 설명 —
 * ? 툴팁과 도움말 drawer가 공유하는 단일 소스.
 */
export interface GlossaryTerm {
  name: string;
  unit: string;
  desc: string;
}

export const GLOSSARY = {
  demand: {
    name: '현재수요',
    unit: 'MW',
    desc: '지금 이 순간 전국에서 사용 중인 전력의 총량입니다.',
  },
  capacity: {
    name: '공급능력',
    unit: 'MW',
    desc: '지금 발전소들이 최대로 공급할 수 있는 전력의 총량입니다.',
  },
  reserve: {
    name: '공급예비력',
    unit: 'MW',
    desc: '공급능력에서 현재수요를 뺀 여유분입니다. 5,500MW 미만으로 내려가면 전력수급 비상단계(준비)가 시작됩니다.',
  },
  reserveRate: {
    name: '공급예비율',
    unit: '%',
    desc: '여유분(예비력)이 현재수요의 몇 %인지를 나타냅니다. 높을수록 계통에 여유가 있다는 뜻입니다.',
  },
  smp: {
    name: 'SMP (계통한계가격)',
    unit: '원/kWh',
    desc: '발전사가 생산한 전력을 판매할 때 적용되는 시간별 도매 단가입니다. 육지와 제주가 따로 정해집니다.',
  },
  rec: {
    name: 'REC (신재생에너지 공급인증서)',
    unit: '원/REC',
    desc: '신재생에너지로 1MWh를 발전하면 발급되는 인증서입니다. 현물시장에서 거래되며 태양광 수익의 큰 축입니다.',
  },
  recWeight: {
    name: 'REC 가중치',
    unit: '배',
    desc: '설비 유형·규모에 따라 REC 발급량에 곱해지는 계수입니다. 예: 일반부지 태양광 1.0, 건축물 활용 시 1.5.',
  },
  brokerFee: {
    name: '중개 수수료율',
    unit: '%',
    desc: '전력거래 중개사업자를 통해 거래할 때 판매 수익에서 차감되는 수수료 비율입니다.',
  },
  genMethod: {
    name: '발전량 산정 방식',
    unit: '',
    desc: '"지역 실적 비례"는 같은 지역의 공공데이터 발전 실적을 내 설비용량에 비례 배분해 추정합니다. 설비이용률을 직접 입력할 수도 있습니다.',
  },
  recPrice: {
    name: 'REC 가격 기준',
    unit: '',
    desc: '수익 계산에 현물시장 평균가를 쓸지 종가를 쓸지 선택합니다. 종가는 육지 시장 기준 단일값입니다(제주는 별도 평균가 참고). 평균가가 좀 더 보수적인 기준입니다.',
  },
  capacityFactor: {
    name: '설비이용률',
    unit: '%',
    desc: '설비가 최대 출력으로 쉬지 않고 돌았다고 가정했을 때 대비 실제 발전량의 비율입니다. 국내 태양광은 보통 13~17% 수준입니다.',
  },
  marketArea: {
    name: '육지/제주 시장',
    unit: '',
    desc: '제주는 계통이 분리되어 SMP가 육지와 따로 정해집니다. 설비 위치에 맞는 시장을 선택하세요.',
  },
  mae: {
    name: 'MAE (평균절대오차)',
    unit: 'MWh',
    desc: '예측이 실제와 평균 몇 MWh 어긋났는지입니다. 작을수록 정확합니다.',
  },
  mape: {
    name: 'MAPE (평균절대백분율오차)',
    unit: '%',
    desc: '오차를 실제값 대비 %로 나타낸 지표입니다. 10%면 실제의 ±10% 안팎으로 맞췄다는 뜻입니다.',
  },
} as const satisfies Record<string, GlossaryTerm>;

export type GlossaryKey = keyof typeof GLOSSARY;

export function glossaryTip(key: GlossaryKey): string {
  const t = GLOSSARY[key];
  return t.unit ? `${t.name} (${t.unit}) — ${t.desc}` : `${t.name} — ${t.desc}`;
}
