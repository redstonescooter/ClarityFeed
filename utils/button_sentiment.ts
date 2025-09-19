export class OptionButton {
    text: string;
    ref: any;
    score?: number;
}

export function security_question_sentiment(options: OptionButton[], choose_positive = true): OptionButton {
    const confirmation_keywords = ["yes", "yes", "correct", "right", "good", "that's it", "okay", "ok"];
    const change_keywords = ["no", "no", "change", "update", "wrong", "replace", "new"];
    let top_score = -10000;
    let winner: OptionButton | null = null;
    const increment: number = choose_positive ? 1 : -1;

    for (const option of options) {
        option.score = 0;
        for (const word of confirmation_keywords) {
            if (option.text.toLowerCase().includes(word.toLowerCase())) {
                option.score += increment;
            }
        }
        for (const word of change_keywords) {
            if (option.text.toLowerCase().includes(word.toLowerCase())) {
                option.score -= increment;
            }
        }
        if (option.score > top_score) {
            top_score = option.score;
            winner = option;
        }
    }

    if (!winner) {
        throw new Error("No winner was determined from the options");
    }

    return winner;
}