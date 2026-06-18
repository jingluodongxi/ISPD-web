import re, os, sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\dell\Desktop\网址\可读原始代码-备份\compute.js", "r", encoding="utf-8") as f:
    code = f.read()

# Remove line comments (check not inside string)
lines = code.split("\n")
clean = []
for line in lines:
    pos = line.find("//")
    if pos >= 0:
        before = line[:pos]
        sq = before.count("'")
        dq = before.count('"')
        if sq % 2 == 0 and dq % 2 == 0:
            line = before
    clean.append(line)
code = "\n".join(clean)

# Remove block comments
code = re.sub(r"/\*.*?\*/", "", code, flags=re.DOTALL)

# Collapse spaces (keep newlines)
code = re.sub(r"[ \t]+", " ", code)
code = re.sub(r"\n\s*\n+", "\n", code)
code = code.strip()

out_path = r"C:\Users\dell\Desktop\网址\compute.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(code)

orig = os.path.getsize(r"C:\Users\dell\Desktop\网址\可读原始代码-备份\compute.js")
mini = os.path.getsize(out_path)
print(f"Original: {orig} bytes, Minified: {mini} bytes ({100*mini//orig}%)")
