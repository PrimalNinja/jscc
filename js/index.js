// Developed by Julian Cassin. 2019-2020.
//
var objInput = ace.edit("ge-input");
objInput.setTheme("ace/theme/monokai");
objInput.session.setMode("ace/mode/javascript");

objInput.clearSelection();
objInput.navigateFileStart();
objInput.focus();

var objOutput = ace.edit("ge-output");
objOutput.setTheme("ace/theme/monokai");
objOutput.session.setMode("ace/mode/assembly_x86");

var objOptions = {
	debugcompiler: false,
	errorelement: '#ge-errors',
	includecomments: false,
	includeignoredstatements: false,
	includesourceascomments: false,
	includesourcewhitespace: false,
	showsourcelinenumbers: true
};

function reCompile()
{
	objOutput.setValue(compile(objInput.getValue(), objOptions));
	//objOutput.setValue(IFtoPF(objInput.getValue()));
	objOutput.clearSelection();
	objOutput.navigateFileStart();
}

objInput.on("change", function(e)
{
	reCompile();
});

function onReConfig()
{
	objOptions.debugcompiler = $('#debugCompiler').is(":checked");
	objOptions.includecomments = $('#includeComments').is(":checked");
	objOptions.includesourceascomments = $('#includeSourceAsComments').is(":checked");
	objOptions.includesourcewhitespace = $('#includeSouceWhitespace').is(":checked");
	objOptions.showsourcelinenumbers = $('#includeSourceLineNumbers').is(":checked");

	reCompile();
}

reCompile();
