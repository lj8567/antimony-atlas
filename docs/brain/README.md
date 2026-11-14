# Daily Six

An offline brain-training web app with six challenges a day: dual n-back, mental maths, number memory, probability, senior maths and GMAT/LSAT.

Open `https://lj8567.github.io/antimony-atlas/brain/` in Safari, then Share → Add to Home Screen.

## Adding questions

All questions live in `questions.json`. The current ones are samples. Each question looks like this:

```json
{
  "id": "smc-008",
  "category": "smc",
  "difficulty": 3,
  "prompt": "What is the units digit of \\(3^{100}\\)?",
  "choices": ["1", "3", "7", "9", "5"],
  "answer": "A",
  "explanation": "Powers of 3 end in 3, 9, 7, 1 and repeat every 4.",
  "source": "original"
}
```

- `id` must be unique. Change or delete an id and that question's history is lost.
- `category` is `probability`, `smc` or `gmat` (GMAT/LSAT share one category).
- With `choices` (2 to 6), `answer` is the letter of the right choice.
- Without `choices`, you type the answer. `answer` can be a number, a fraction like `"3/8"`, or a percentage. Decimals with 3 or more significant figures are accepted if they're right to the last digit typed. Add `"accept": ["..."]` for other forms you want counted as right.
- Maths goes between `\\(` and `\\)` for inline or `\\[` and `\\]` for display (doubled backslashes because it's JSON). Dollar signs are left alone, so GMAT money questions are fine.
- Use `\n` in a prompt for a line break.

Bad entries are skipped and listed in Settings → Question bank.

After pushing new questions, open the app twice: the first launch downloads them, the second shows them.

## Changing the day

The numbers at the top of `app.js` (`CONFIG`) set questions per category, n-back blocks, the maths sprint length and the number-memory rules. If you add a new file to the app, add it to `PRECACHE` in `sw.js` and bump `CACHE`.
