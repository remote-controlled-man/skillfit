# Maintainer reference

The reference `query-shape/index.js` is byte-identical to upstream fix
`92eb7034f4c01c2075926a53261080a7fb2a93a7`. Query sorting previously converted
bare parameters into assigned empty strings. The repair preserves which
parameters originally lacked an equals sign while retaining sorting and existing
normalization. An explicitly empty assigned value keeps its equals sign.

The Node-only oracle regression is locally authored against the reported public
failure. Hidden cases cover six public behavior groups; two other checks protect
supplied files and validate new test-case evidence on submitted/original/reference
source. This replay does not run the upstream AVA, coverage, lint or type tools.
