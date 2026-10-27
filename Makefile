PYTHON ?= /usr/bin/python3
GJS ?= gjs

.PHONY: test package install uninstall
test:
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py' -v
	LANGUAGE=en_IE $(GJS) -m tests/test-model.js en
	LANGUAGE=zh_CN $(GJS) -m tests/test-model.js zh
	LANGUAGE=de_DE $(GJS) -m tests/test-model.js en
	$(GJS) -m tests/test-client.js

package: test
	$(PYTHON) tools/manage.py package

install:
	$(PYTHON) tools/manage.py install

uninstall:
	$(PYTHON) tools/manage.py uninstall
