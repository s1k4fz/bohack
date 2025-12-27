import kaiwu as kw
from kaiwu.core import BinaryModel, Binary

model = BinaryModel()
q1 = Binary('q1')
q2 = Binary('q2')

model.set_objective(3 * q1)
model.add_constraint(q1 + q2 == 1, name='c1')

model.compile_constraints()

print(f"Model compiled attr: {getattr(model, 'compiled', 'Not Found')}")

# Maybe logic is in constraint_handler?
