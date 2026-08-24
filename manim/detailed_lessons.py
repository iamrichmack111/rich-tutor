
from manim import *
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "lessons" / "lessons.json"

def lessons():
    return json.loads(DATA.read_text())

class DetailedLesson(Scene):
    LESSON_ID = 1

    def construct(self):
        lesson = next(x for x in lessons() if x["id"] == self.LESSON_ID)
        title = Text(lesson["title"], font_size=44).to_edge(UP)
        shortcut = Text(lesson["shortcut"], font_size=24).next_to(title, DOWN)
        self.play(Write(title), FadeIn(shortcut))
        self.wait(1)

        problem = Text(lesson["problem"], font_size=58).move_to(UP*1.2)
        self.play(Write(problem))
        self.wait(1)

        for i, step in enumerate(lesson["steps"], 1):
            label = Text(f"{i}. {step['title']}", font_size=30)
            equation = Text(step["equation"], font_size=42)
            explanation = Text(step["explanation"], font_size=22)
            group = VGroup(label, equation, explanation).arrange(DOWN, buff=.28)
            group.move_to(DOWN*.35)
            self.play(LaggedStart(*[FadeIn(x, shift=RIGHT) for x in group], lag_ratio=.18))
            self.wait(1.4)
            self.play(FadeOut(group))

        final = Text("Try it yourself!", font_size=38).move_to(DOWN*.2)
        practice = Text(lesson["practice"], font_size=28).next_to(final, DOWN)
        self.play(Write(final), FadeIn(practice))
        self.wait(2)

# Dynamically create Lesson01...Lesson20 scene classes
for item in lessons():
    name = f"Lesson{item['id']:02d}"
    globals()[name] = type(name, (DetailedLesson,), {"LESSON_ID": item["id"]})
