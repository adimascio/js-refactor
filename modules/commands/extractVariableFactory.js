'use strict';

var j = require('jfp');

function extractVariableFactory(
    logger,
    editActionsFactory,
    extensionHelper,
    sourceUtils,
    selectionFactory,
    utilities,
    extractVariableAction,
    vsCodeFactory) {

    return function (_, callback) {

        function applyRefactor(vsEditor, selectionData, scopeData, lines) {
            var scopeBounds = j.deref('scopeBounds')(scopeData);
            var valueInScope = extractVariableAction.isValueInScope(scopeBounds, selectionData.selectionCoords);

            if (selectionData.selection === null) {
                logger.info('Cannot extract empty selection as a variable');
            } else if (selectionData.selection.length > 1) {
                logger.info('Extract variable does not currently support multiline values');
            } else if (!valueInScope) {
                logger.info('Cannot extract variable if it is not inside a function');
            } else {
                const items = ['const', 'let', 'var'];
                const options = {
                    prompt: 'Choose your variable type:'
                };

                logger.quickPick(items, options, function (varType) {
                    logger.input({ prompt: 'Name of your variable' }, function (name) {
                        buildAndApply(vsEditor, selectionData, scopeData, name, varType, lines);
                    });
                });
            }
        }

        function buildAndApply(vsEditor, selectionData, scopeData, name, varType, lines) {
            var bounds = scopeData.scopeBounds;


            const escapePattern = /([.+*[\]()\\])/g;
            const selection = selectionData.selection[0];
            const escapedSelection = selection.replace(escapePattern, '\\$1');
            const selectionPattern = new RegExp(escapedSelection, 'g');

            var scopeSource = sourceUtils.getScopeLines(lines, bounds).join('\n');
            var replacementSource = scopeSource.replace(selectionPattern, name);

            var editActions = editActionsFactory(vsEditor);

            var varCoords = extractVariableAction.buildVarCoords(scopeData);
            var variableString = extractVariableAction.buildVariableString(name, varType, selectionData);

            editActions.applySetEdit(replacementSource, bounds).then(function () {
                editActions.applySetEdit(variableString, varCoords).then(callback);
            });
        }


        function getSelectionData(vsEditor) {
            return {
                selection: selectionFactory(vsEditor).getSelection(0),
                selectionCoords: utilities.buildCoords(vsEditor, 0)
            };
        }

        return function extractAction() {
            var vsEditor = vsCodeFactory.get().window.activeTextEditor;

            var getScopeBounds = extensionHelper.returnOrDefault(null, sourceUtils.scopeDataFactory);
            var selectionData = getSelectionData(vsEditor);



            var lines = utilities.getEditorDocument(vsEditor)._lines;
            var scopeData = getScopeBounds(lines, selectionData);

            applyRefactor(vsEditor, selectionData, scopeData, lines);
        }
    }
}

module.exports = extractVariableFactory;
