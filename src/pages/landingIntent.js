export const LANDING_USE_CASES = [
  { topic: 'relationships', label: 'Отношения', question: 'Почему меня снова привлекают похожие люди?', description: 'Посмотреть на повторяющиеся сценарии, близость, доверие и то, что важно для вас в отношениях.' },
  { topic: 'self', label: 'О себе', question: 'Почему я хочу перемен, но всё время сомневаюсь?', description: 'Исследовать противоречивые желания, реакции и стороны себя, которые бывает сложно понять.' },
  { topic: 'work', label: 'Работа и направление', question: 'Почему эта работа меня так истощает?', description: 'Посмотреть на отношение к работе, изменениям и среде, в которой вам комфортнее действовать.' },
];

export const landingIntent = useCase => ({ topic: useCase.topic, question: useCase.question, source: 'landing_use_case' });

export const LANDING_RELATIONSHIP_INTENT = Object.freeze({ topic: 'relationships', source: 'landing_relationship' });
export const isLandingRelationshipIntent = value => value?.topic === LANDING_RELATIONSHIP_INTENT.topic &&
  value?.source === LANDING_RELATIONSHIP_INTENT.source;

export const normalizeLandingIntent = value => {
  if (!value || value.source !== 'landing_use_case') return null;
  const useCase = LANDING_USE_CASES.find(item => item.topic === value.topic && item.question === value.question);
  return useCase ? landingIntent(useCase) : null;
};
