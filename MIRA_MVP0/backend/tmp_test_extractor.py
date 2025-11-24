from memory_extractor import get_memory_extractor
try:
    ex = get_memory_extractor()
    print('extractor type:', type(ex))
    res = ex.analyze('I like pizza')
    print('analyze result:', res)
except Exception as e:
    print('error:', repr(e))
