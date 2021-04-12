from cedict_utils.cedict import CedictParser
import wordfreq
# from cjklib.reading import ReadingFactory
# f = ReadingFactory()
import regex as re
import json

parser = CedictParser()
entries = parser.parse()

top_n = wordfreq.top_n_list("zh", 20000)

data = {}

PinyinToneMark = {
    0: "aoeiuv\u00fc",
    1: "\u0101\u014d\u0113\u012b\u016b\u01d6\u01d6",
    2: "\u00e1\u00f3\u00e9\u00ed\u00fa\u01d8\u01d8",
    3: "\u01ce\u01d2\u011b\u01d0\u01d4\u01da\u01da",
    4: "\u00e0\u00f2\u00e8\u00ec\u00f9\u01dc\u01dc",
}

def decode_pinyin(s):
    s = s.lower()
    r = ""
    t = ""
    for c in s:
        if c >= 'a' and c <= 'z':
            t += c
        elif c == ':':
            assert t[-1] == 'u'
            t = t[:-1] + "\u00fc"
        else:
            if c >= '0' and c <= '5':
                tone = int(c) % 5
                if tone != 0:
                    m = re.search("[aoeiuv\u00fc]+", t)
                    if m is None:
                        t += c
                    elif len(m.group(0)) == 1:
                        t = t[:m.start(0)] + PinyinToneMark[tone][PinyinToneMark[0].index(m.group(0))] + t[m.end(0):]
                    else:
                        if 'a' in t:
                            t = t.replace("a", PinyinToneMark[tone][0])
                        elif 'o' in t:
                            t = t.replace("o", PinyinToneMark[tone][1])
                        elif 'e' in t:
                            t = t.replace("e", PinyinToneMark[tone][2])
                        elif t.endswith("ui"):
                            t = t.replace("i", PinyinToneMark[tone][3])
                        elif t.endswith("iu"):
                            t = t.replace("u", PinyinToneMark[tone][4])
                        else:
                            t += "!"
            r += t
            t = ""
    r += t
    return r

for e in entries:
    word = e.simplified
    if word in top_n:
        pinyin = decode_pinyin(e.pinyin)
        if word in data:
            data[word].append({ 'meanings': e.meanings, 'traditional': e.traditional, 'pinyin_number': e.pinyin, 'pinyin': pinyin})
        else:        
            data[word] = [{ 'meanings': [e.meanings], 'traditional': e.traditional, 'pinyin_number': e.pinyin, 'pinyin': pinyin }]

with open('chinese.json', 'w') as f:
    f.write(json.dumps(data))