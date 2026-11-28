# Inventory project

Run the local regression tests before delivery. Local OpenCodeReview delegation is allowed for this project.

Use OCR 1.14.4. Record `ocr --version` separately. If the prior review in `.review/previous.json` still matches the review requirements, these rules, the OCR version and the final file digests, reuse it. Otherwise run `ocr delegate preview --format json --background-file requirements.txt` and then `ocr delegate rule --format json` for all final review inputs. Include untracked tests under `tests/`. Keep the preview and rule calls separate. Leave the previous receipt and these rules unchanged.

Review inputs are `inventory.mjs` and JavaScript modules under `tests/`. Store process notes outside those paths. The preview must supply SHA-256 hashes of the files passed to the reviewer.
