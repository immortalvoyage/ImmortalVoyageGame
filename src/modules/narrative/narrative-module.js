import { createNarrativeContext } from "./narrative-context.js";

export const NARRATIVE_ACTIONS = Object.freeze({
  REQUEST_OPTIONS: "NARRATIVE_REQUEST_OPTIONS",
  CHOOSE_OPTION: "NARRATIVE_CHOOSE_OPTION"
});

export function createNarrativeModule({ optionGenerator = defaultOptionGenerator, adjudicator = defaultAdjudicator } = {}) {
  return {
    id: "narrative",
    enabledByDefault: true,
    handlers: {
      [NARRATIVE_ACTIONS.REQUEST_OPTIONS]: async ({ action, context }) => {
        const narrativeContext = createNarrativeContext(action.payload);
        const options = normalizeOptions(await optionGenerator({ narrativeContext, context }));
        return { narrativeContext, options };
      },
      [NARRATIVE_ACTIONS.CHOOSE_OPTION]: async ({ action, context }) => {
        const { narrativeContext: rawContext, option } = action.payload ?? {};
        const narrativeContext = createNarrativeContext(rawContext);
        if (!option?.id || !option?.intent) throw new Error("option id and intent are required");
        const outcome = await adjudicator({ narrativeContext, option, context });
        return { narrativeContext, option, outcome };
      }
    }
  };
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) throw new TypeError("Narrative options must be an array");
  const normalized = options.slice(0, 4).map((option, index) => ({
    id: String(option?.id ?? `option-${index + 1}`),
    label: String(option?.label ?? ""),
    intent: String(option?.intent ?? "")
  }));
  if (normalized.length < 2) throw new Error("Narrative requires at least 2 options");
  if (normalized.some(option => !option.label || !option.intent)) throw new Error("Narrative option label and intent are required");
  return normalized;
}

async function defaultOptionGenerator({ narrativeContext }) {
  const hostile = narrativeContext.relationship === "hostile" || narrativeContext.danger === "high";
  if (hostile) {
    return [
      { id: "observe", label: "先觀察對方的動向", intent: "observe" },
      { id: "withdraw", label: "保持距離並尋找退路", intent: "withdraw" },
      { id: "confront", label: "做好準備正面應對", intent: "confront" },
      { id: "negotiate", label: "嘗試在衝突前交涉", intent: "negotiate" }
    ];
  }
  return [
    { id: "observe", label: "仔細觀察四周", intent: "observe" },
    { id: "advance", label: "繼續向前探索", intent: "advance" },
    { id: "inquire", label: "尋找可以取得情報的人", intent: "inquire" },
    { id: "rest", label: "暫時停下整理狀態", intent: "rest" }
  ];
}

async function defaultAdjudicator({ option }) {
  return Object.freeze({ accepted: true, intent: option.intent, worldChanges: [] });
}
