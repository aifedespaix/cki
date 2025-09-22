import {
  GameConclusionReason,
  GameStatus,
  type PlayerRole,
} from "@/lib/game/types";

export const roleLabels: Record<PlayerRole, string> = {
  host: "Hôte",
  guest: "Invité",
};

export const formatStatusLabel = (status: GameStatus): string => {
  switch (status) {
    case GameStatus.Idle:
      return "Initialisation";
    case GameStatus.Lobby:
      return "Préparation de la partie";
    case GameStatus.Playing:
      return "En cours";
    case GameStatus.Finished:
      return "Partie terminée";
    default:
      return status;
  }
};

export const getConclusionLabel = (reason: GameConclusionReason): string => {
  switch (reason) {
    case GameConclusionReason.CorrectGuess:
      return "Victoire sur bonne réponse";
    case GameConclusionReason.IncorrectGuess:
      return "Victoire par mauvaise réponse";
    default:
      return reason;
  }
};
