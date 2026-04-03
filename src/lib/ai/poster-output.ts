export const parsePosterOutput = (value: string) => {
  const posterConceptMatch = value.match(/Poster Concept:\s*([\s\S]*?)(?=Image Prompt:|$)/i);
  const imagePromptMatch = value.match(/Image Prompt:\s*([\s\S]*?)$/i);
  const imageUrlMatch = value.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp)/i);

  return {
    posterConcept: posterConceptMatch?.[1]?.trim() || "",
    imagePrompt: imagePromptMatch?.[1]?.trim() || "",
    imageUrl: imageUrlMatch?.[0] || "",
  };
};
