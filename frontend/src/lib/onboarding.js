// Answers collected during host setup (vehicle type, helmet or seats, vehicle details), saved at the last step.
let draft = {};

export const getDraft = () => draft;
export const updateDraft = (changes) => (draft = { ...draft, ...changes });
export const resetDraft = () => (draft = {});
