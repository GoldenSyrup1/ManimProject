from manim import *




class Testing(Scene):
    def construct(self):

        name = Text("Syrup").to_edge(UL, buff=0.5)
        sq = Square(side_length = 0.5, fill_color = GREEN).shift(LEFT*3 + UP*3)
        tri = Triangle().scale(0.6).to_edge(DR)
        circ = Circle(radius = 3, color = RED)
        self.play(Write(name), run_time=1)
        self.play(DrawBorderThenFill(sq))
        self.play(Create(tri), run_time=1)
        self.play(Create(circ), run_time = 2)
        self.wait()

        self.play(name.animate.to_edge(UR), run_time = 2)
        self.play(sq.animate.scale(2), tri.animate.to_edge(DL), run_time=3)
