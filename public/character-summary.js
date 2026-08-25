export function buildCharacterSummaryRows(view) {
  const character = view?.character;
  if (!character) return [];

  const rows = [['姓名', character.name]];

  const careers = Array.isArray(view.careers) ? view.careers : [];
  if (careers.length > 0) {
    rows.push(['身分', careers.map((career) => career.name).join('、')]);
  }

  const currentEmployment = view.employment?.current;
  if (currentEmployment) {
    rows.push([
      '現職',
      `${currentEmployment.job.title}｜雇主：${currentEmployment.employer.name}｜工作地：${currentEmployment.workplace.name}｜每次報酬：${currentEmployment.wagePerWork}`,
    ]);
  }

  const skills = Array.isArray(view.progression?.skills) ? view.progression.skills : [];
  if (skills.length > 0) {
    rows.push(['技能', skills.map((skill) => skill.name).join('、')]);
  }

  const socialTags = Array.isArray(view.progression?.socialTags) ? view.progression.socialTags : [];
  if (socialTags.length > 0) {
    rows.push(['社會標籤', socialTags.map((tag) => tag.name).join('、')]);
  }

  const relationships = Array.isArray(view.relationships) ? view.relationships : [];
  if (relationships.length > 0) {
    rows.push([
      '關係',
      relationships
        .map((relationship) => `${relationship.npc.name}：${relationship.familiarity.name}`)
        .join('、'),
    ]);
  }

  const knowledge = Array.isArray(view.knowledge) ? view.knowledge : [];
  if (knowledge.length > 0) {
    rows.push(['已知情報', knowledge.map((fact) => fact.name).join('、')]);
  }

  const inventoryText = (view.inventoryItems ?? [])
    .map((item) => `${item.name} × ${item.quantity}`)
    .join('、') || '空';

  rows.push(
    ['貨幣', String(character.money)],
    ['飢餓', String(character.needs.hunger)],
    ['口渴', String(character.needs.thirst)],
    ['疲勞', String(character.needs.fatigue)],
    ['背包', inventoryText],
  );

  return rows;
}
