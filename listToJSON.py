# -*- coding: utf-8 -*-
# A simple python script for converting a txt file list to json. used to construct lists for random names
from sys import argv

f = open(argv[1])
words = f.read().split('\n')
json = "["
isFirst = True
for w in words[0:]:
    if len(w) <= 1:
        continue
    if isFirst:
        # note. python strip doesn't replace unicode spaces. need a better solution than this
        test = '"' + w.replace(" ", "").strip() + '"'
        json += test
        isFirst = False
    else:
        json += ',"' + w.replace(" ", "").strip() + '"'

json += "]"
f.close()

f = open(argv[2], 'w')
f.write(json)
f.close()
