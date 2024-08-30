// JSCompile v0.3 (30 August 2024) By Julian Cassin:
// 
// This is a work in progress JavaScript (subset) to Z80 compiler.
//
// todo:
//
// - NEW, object allocation
// - CALL, function
// - PARAMETERS
// - RETURN
//
// bugs:
//	- remove a return void immediately following another return, usually as 
//    a result of falling off a function
//
// limitations:
//
//  - classes for now are purely syntactic sugar, the NEW statement doesn't actually create a new instance of a class
//	- Parenthesis { and } should be only 1 on a new line
//	- Parenthesis { and } must be present for all code blocks
//	- no recursion (for now), all variables and parameters are NOT locals
//	- statements must be on a single line
//  - all statements should end in a semi-colon ;
//	- except for the class function and it's members, function declarations 
//    cannot be nested
//	- functions cannot be anonymous
//	- only functions can be global (i.e. they are classes)
//	- no global variables
//	- functions cannot be nested below that of the containing class function
//
// options:
//
//  - includecomments
//  - includesourceascomments
//  - includesourcewhitespace
//  - includeignoredstatements
//
//	done:
//
//						whitespace
//						source_comment, original_comment
//	function 			class_start, class_end, return_void
//						call_constructor, constructor_start, constructor_end
//	function			publicfunction_start, publicfunction_end, declare_parameters, 
//	function			privatefunction_start, privatefunction_end, declare_parameters
//	if					if_start, if_end
//						constructor_if_start, constructor_if_end
//	while				while_start, while_end
//						constructor_while_start, constructor_while_end
//	var					declare_variable, set_variable
//						constructor_declare_variable, constructor_set_variable
//						reserve_variable, 
//	evaluation			eval_expression
//						constructor_eval_expression
//	return				return_void
//	return <x>			return_value
//	<x>					call
//
// Operators supported in precedence order:
//
// NEW, !, ~, ++, --, **, *, /, %, +, -, <<, >>, >>>, 
// <, <=, >, >=, ==, !=, ===, !==, &, ^, |, &&, ||, 
// +=, -=, **=, *=, /=, %=, <<=, >>=, >>>=, &=, ^=, |=
// 
// Operators treated special:
//
// =
// Operators not yet supported:
// 
// -x, TYPEOF, DELETE, IN, INSTANCEOF, ++x, --x
//
// To target an alternate CPU, currently all actual target CPU code is within the following
// output functions, once an initial target CPU is completed and working, it is likely a plugin 
// target solution will be added:
//
//  - outputCall
//  - outputComment
//  - outputDefineWord
//  - outputExpression
//  - outputJump
//  - outputJumpZero
//  - outputLabel
//  - outputReturn
//  - outputSetVariable
// 
// type the below function below and see the compiled code on the right appear as you type
// 
// function Example1()
// {
//     var TEST1=1;
//     var TEST2=TEST1*5;
//     var TEST3=(TEST2+TEST1)*2;
//     
//     var loopCounter=10;
//     while (loopCounter>0)
//     {
//         loopCounter--;
//     }
// }
// 
// function Example2()
// {
//     var TEST1=6+3*4/2-9;
//     var TEST2   =   6 + 3 * 4 / 2 - 9;
//     var TEST3=(6 + (((3 * 4) / 2) - 9));
//     var TEST4=(6+(((3*4)/2)-9));
//     var TEST5=(6+3)*4/(2-9);
//     var TEST6=TEST1++;
// }
// 
// // example class structure
// function myClass()
// {
//     var myMemberVariable = 1;
//     function myMemberMethod()
//     {
//     	 var myFunctionVariable = 2;
//     }
//     myMemberMethod(); // call member method (becomes part of constructor)
// }
//
// function myClass2()
// {
//     var myMemberVariable;
//     function myMemberMethod()
//     {
//     	 myMemberVariable = new myClass();
//     }
//     myMemberMethod(); // call member method (becomes part of constructor)
// }
function compile(strInput_a, objOptions_a)
{
	var arrInput = strInput_a.split('\n');	// raw input is accessible directly by line number, line string
	var arrFunctions = [];
	var arrLabels = [];
	var arrTypes = [];
	var arrOutput1 = [];
	var arrOutput2 = [];
	var arrVariables = [];
	var blnFound = false;
	var blnInClass = false;
	var blnInPrivateFunction = false;
	var blnInPublicFunction = false;
	var intBraceNestCount = 0;
	var intLabel = 1;
	var intLabelPopped = 0;
	var strConstructorPrefix = '';
	var strExpression = '';
	var strInClassName = '';
	var strInFunctionName = '';
	var strParameters = '';
	var strResult = '';
	var strType = '';
	var strVariable = '';
	
	// map operators to system functions
	var OPERATORMAP = [	'_NEW_', 'sys_new',
						'_!_', 'sys_not',
						'_~_', 'sys_bitnot',
						'_++_', 'sys_addadd',
						'_--_', 'sys_subsub',
						'_TYPEOF_', 'sys_typeof',
						'_DELETE_', 'sys_delete',
						'_**_', 'sys_multmult',
						'_*_', 'sys_mult',
						'_/_', 'sys_div',
						'_%_', 'sys_mod',
						'_+_', 'sys_add',
						'_-_', 'sys_sub',
						'_<<_', 'sys_bitshiftleft',
						'_>>_', 'sys_bitshiftright',
						'_>>>_', 'sys_bitshiftrightzero',
						'_<_', 'sys_lt',
						'_<=_', 'sys_lte',
						'_>_', 'sys_gt',
						'_>=_', 'sys_gte',
						'_IN_', 'sys_in',
						'_INSTANCEOF_', 'sys_instanceof',
						'_==_', 'sys_equals',
						'_!=_', 'sys_notequals',
						'_===_', 'sys_exactly',
						'_!==_', 'sys_notexactly',
						'_&_', 'sys_bitand',
						'_^_', 'sys_bitxor',
						'_|_', 'sys_bitor',
						'_&&_', 'sys_and',
						'_||_', 'sys_or',
						'_=_', 'sys_assign',
						'_+=_', 'sys_addassign',
						'_-=_', 'sys_subassign',
						'_**=_', 'sys_exponentassign',
						'_*=_', 'sys_multassign',
						'_/=_', 'sys_divassign',
						'_%=_', 'sys_modassign',
						'_<<=_', 'sys_bitshiftleftassign',
						'_>>=_', 'sys_bitshiftrightassign',
						'_>>>=_', 'sys_bitshiftrightzeroassign',
						'_&=_', 'sys_bitandassign',
						'_^=_', 'sys_bitxorassign',
						'_|=_', 'sys_bitorassign'
						]; // -x, ++x, --x unsupported
	
	// compiler options
	var objOptions = {
		debugcompiler: false,
		errorelement: '',
		includecomments: true,
		includeignoredstatements: false,
		includesourceascomments: false,
		includesourcewhitespace: false,
		showsourcelinenumbers: false
	};
	
	if (objOptions_a !== undefined)
	{
		if (objOptions_a.debugcompiler !== undefined) { objOptions.debugcompiler = objOptions_a.debugcompiler; }
		if (objOptions_a.errorelement !== undefined) { objOptions.errorelement = objOptions_a.errorelement; }
		if (objOptions_a.includecomments !== undefined) { objOptions.includecomments = objOptions_a.includecomments; }
		if (objOptions_a.includeignoredstatements !== undefined) { objOptions.includeignoredstatements = objOptions_a.includeignoredstatements; }
		if (objOptions_a.includesourceascomments !== undefined) { objOptions.includesourceascomments = objOptions_a.includesourceascomments; }
		if (objOptions_a.includesourcewhitespace !== undefined) { objOptions.includesourcewhitespace = objOptions_a.includesourcewhitespace; }
		if (objOptions_a.showsourcelinenumbers !== undefined) { objOptions.showsourcelinenumbers = objOptions_a.showsourcelinenumbers; }
	}
	
	// utils
	function doNothing()
	{
		var todo = 'this function is just to stop lint errors where we dont want to do anything';
	}
	
	// process an array util
	function processArray(arr_a, cb_a)
	{
		var blnCancelled = false;
		var intI = 0;
		
		while ((intI < arr_a.length) && !blnCancelled)
		{
			if ($.isFunction(cb_a))
			{
				blnCancelled = cb_a(arr_a[intI], intI);
			}
			
			intI++;
		}
	}

	// render errors
	function renderErrors()
	{
		var strErrors = '';
		
		processArray(arrResult, function(objLine_a)
		{
			if (objLine_a.action === 'error')
			{
				//strErrors += objLine_a.error + ' at line ' + objLine_a.linenumber + '<br />';
				if (objLine_a.linenumber >= 0)
				{
					strErrors += 'ERROR: ' + objLine_a.error + ' at line ' + objLine_a.linenumber + '\n';
				}
				else
				{
					strErrors += 'ERROR: ' + objLine_a.error + '\n';
				}
			}
		});
		
		if (strErrors.length > 0)
		{
			strErrors = '\n\n' + strErrors;
		}
		
		//$(objOptions.errorelement).html(strErrors);
		return strErrors;
	}

	// string replacement util
	function str_replace(strHaystack_a, strOld_a, strNew_a)
	{
		var strResult = strHaystack_a;
		var intPos = strHaystack_a.indexOf(strOld_a);
		
		while (intPos >= 0)
		{
			strResult = strResult.replace(strOld_a, strNew_a);
			intPos = strResult.indexOf(strOld_a);
		}
		
		return strResult;
	}
	
	// parse 1 pushes a structure onto the result array for later code generation
	function parse1(arrInput_a)
	{
		arrResult = [];
		
		function getVariable(strClassName_a, strFunctionName_a, str_a)
		{
			var strResult = '';
			var strVariable = strClassName_a + '_' + strFunctionName_a + '_' + str_a;
			
			if (isVariable(strVariable))
			{
				strResult = strVariable.toLowerCase();
			}
			else
			{
				strVariable = strClassName_a + '__' + str_a;
				
				if (isVariable(strVariable))
				{
					strResult = strVariable.toLowerCase();
				}
			}
			
			return strResult;
		}

		function isVariable(str_a)
		{
			var blnResult = false;
			
			// process variables
			processArray(arrVariables, function(objVariable_a)
			{
				if (objVariable_a.line.toLowerCase() === str_a.toLowerCase())
				{
					blnResult = true;
					return true;
				}
			});
			
			return blnResult;
		}
		
		// process each line of input
		processArray(arrInput_a, function(strLine_a, intLineNumber_a)
		{
			var intEnd = -1;
			var intLineNumber = intLineNumber_a + 1;
			var intStart = -1;
			var strOutput = '';
			var strOutputAfter = '';
			var strOutputBefore = '';
			var strInput = strLine_a.trim();
			
			var blnFound = false;
			strExpression = '';
			strVariable = '';

			// comments
			if (strInput.indexOf('//') === 0)	//	don't care if in class or not
			{
				if (objOptions_a.includecomments)
				{
					arrResult.push(
					{ 
						linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
						inconstructor: (strConstructorPrefix.length > 0), action: 'original_comment', error: '', classname: strInClassName, functionname: strInFunctionName,
						parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
					});
				}
			}
			else if (objOptions_a.includesourceascomments)	// add the original source as comments
			{
				arrResult.push(
				{ 
					linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
					inconstructor: (strConstructorPrefix.length > 0), action: 'source_comment', error: '', classname: strInClassName, functionname: strInFunctionName,
					parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
				});
			}

			// whitespace
			if (strInput.length === 0)
			{
				if (objOptions_a.includesourcewhitespace)
				{
					arrResult.push(
					{ 
						linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount, 
						inconstructor: (strConstructorPrefix.length > 0), action: 'whitespace', error: '', classname: strInClassName, functionname: strInFunctionName, 
						parameters: strParameters, expression: strExpression, generated: false, line: strLine_a 
					});
				}
			}
			else
			{
				// comments again
				if (strInput.indexOf('//') === 0)	//	don't care if in class or not
				{
					// do nothing
					doNothing();
				}
				else if (strInput.indexOf('{') === 0)	// start of class or function
				{
					intBraceNestCount++;
					
					if (objOptions_a.includeignoredstatements)
					{
						arrResult.push(
						{ 
							linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
							inconstructor: (strConstructorPrefix.length > 0), action: 'ignore', error: '', classname: strInClassName, functionname: strInFunctionName,
							parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
						});
					}
				}
				else
				{
					if (!blnInClass)	// globals
					{
						if (strInput.indexOf('function ') === 0)	//	new class
						{
							// get class name
							blnInClass = true;
							intLabel = 1;
							intStart = strInput.indexOf(' ');
							intEnd = strInput.indexOf('(', intStart);
							blnFound = (intStart > 0) && (intEnd > 0);
							
							if (!blnFound)
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								intStart++;
								strInClassName = strInput.substring(intStart, intEnd).trim().toUpperCase();

								arrResult.push(	// later should generate label, call constructor, return
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'class_start', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});

								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'call_constructor', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: true, line: strLine_a
								});

								arrResult.push(	// later should generate label, call constructor, return
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'return_void', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: true, line: strLine_a
								});

								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: true, action: 'constructor_start', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: true, line: strLine_a
								});
								
								strConstructorPrefix = 'constructor_';
							}
						}
						else 
						{
							arrResult.push(
							{ 
								linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
								inconstructor: false, action: 'error', error: "unexpected symbol", classname: strInClassName, functionname: strInFunctionName,
								parameters: strParameters, expression: strExpression,generated: false, line: strLine_a
							});
						}
					}
					else	// member functions
					{
						if (strInput.indexOf('function(') > 0)	// new public member function
						{
							// get function name
							blnInPublicFunction = true;
							intStart = strInput.indexOf('.');
							intEnd = strInput.indexOf('=', intStart);
							blnFound = (intStart > 0) && (intEnd > 0);
							
							if (!blnFound)
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								intStart++;
								strInFunctionName = strInput.substring(intStart, intEnd).trim().toUpperCase();
								
								// get function parameters
								intStart = strInput.indexOf('(', intStart);
								intEnd = strInput.indexOf(')', intStart);
								blnFound = (intStart > 0) && (intEnd > 0);
								
								if (!blnFound)
								{
									arrResult.push(
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
								else
								{
									intStart++;
									strParameters = strInput.substring(intStart, intEnd).trim().toUpperCase();

									arrResult.push(	// later should generate label, handle parameters
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'publicfunction_start', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});

									arrResult.push(	// later should generate label, handle parameters
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'declare_parameters', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									
									arrFunctions.push(	// register the function
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'registered_publicfunction', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									
									strConstructorPrefix = '';
								}
							}
						}
						else if (strInput.indexOf('function ') === 0)	// new private member function
						{
							// get function name
							blnInPrivateFunction = true;
							intStart = strInput.indexOf(' ');
							intEnd = strInput.indexOf('(', intStart);
							blnFound = (intStart > 0) && (intEnd > 0);
							
							if (!blnFound)
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								intStart++;
								strInFunctionName = strInput.substring(intStart, intEnd).trim().toUpperCase();

								// get function parameters
								intStart = intEnd;
								intEnd = strInput.indexOf(')', intStart);
								blnFound = (intStart > 0) && (intEnd > 0);
								
								if (!blnFound)
								{
									arrResult.push(
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
								else
								{
									intStart++;
									strParameters = strInput.substring(intStart, intEnd).trim().toUpperCase();

									arrResult.push(	// later should generate label, handle parameters
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'privatefunction_start', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});

									arrResult.push(	// later should generate label, handle parameters
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'declare_parameters', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									
									arrFunctions.push(	// register the function
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'registered_privatefunction', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									
									strConstructorPrefix = '';
								}
							}
						}
						else if (strInput.indexOf('var ') === 0)	// local variables
						{
							// get expression
							intStart = strInput.indexOf(' ');
							intEnd = strInput.indexOf('=', intStart);
							blnFound = (intStart > 0);
							
							if (blnFound)
							{
								if (intEnd <= 0)	// no initialisation
								{
									intEnd = strInput.indexOf(';', intStart);
									strVariable = strInput.substring(intStart, intEnd).trim().toUpperCase();
									strVariable = strInClassName + '_' + strInFunctionName + '_' + strVariable;
									blnFound = false; // to trigger not found for parameters
								}
								else	// with initialisation
								{
									strVariable = strInput.substring(intStart, intEnd).trim().toUpperCase();
									strVariable = strInClassName + '_' + strInFunctionName + '_' + strVariable;
								}
								
								arrVariables.push(	// later should generate labels and storage
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'reserve_variable', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strVariable
								});
								
								arrResult.push(	// later should generate labels and storage
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'declare_variable', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strVariable
								});
							}

							if (blnFound)
							{
								// get expression
								intStart = intEnd;
								intEnd = strInput.length - 1;
								blnFound = (intStart > 0) && (intEnd > 0);
								
								if (!blnFound)
								{
									arrResult.push(
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,  
										inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
								else
								{
									intStart++;
									strExpression = strInput.substring(intStart, intEnd).trim().toUpperCase();

									if (strExpression.length > 0)
									{
										arrResult.push(
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'eval_expression', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
										});

										arrResult.push(
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'set_variable', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: strExpression, generated: false, line: strVariable
										});
									}
								}
							}
						}
						else if ((strInput.indexOf('if ') === 0) || (strInput.indexOf('if(') === 0))	// if statement
						{
							// get expression
							intStart = strInput.indexOf('(');
							blnFound = (intStart > 0);
							
							if (!blnFound)
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								// get expression
								intEnd = strInput.length - 1;
								blnFound = (intStart > 0) && (intEnd > 0);
								
								if (!blnFound)
								{
									arrResult.push(
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,  
										inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
								else
								{
									intStart++;
									strExpression = strInput.substring(intStart, intEnd).trim().toUpperCase();

									arrTypes.push('if');
									
									if (strExpression.length > 0)
									{
										arrResult.push(	// later should generate labels and expression handling
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'if_start', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
										});
									}
									else
									{
										arrResult.push(	// later should generate labels and expression handling
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'if_start', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: '', generated: false, line: strLine_a
										});
									}

									arrLabels.push(intLabel);
									intLabel++;
								}
							}
						}
						else if ((strInput.indexOf('while (') === 0) || (strInput.indexOf('while(') === 0))	// while statement
						{
							// get expression
							intStart = strInput.indexOf('(');
							blnFound = (intStart > 0);
							
							if (!blnFound)
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								// get expression
								intEnd = strInput.length - 1;
								blnFound = (intStart > 0) && (intEnd > 0);
								
								if (!blnFound)
								{
									arrResult.push(
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'error', error: 'syntax error', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
								else
								{
									intStart++;
									strExpression = strInput.substring(intStart, intEnd).trim().toUpperCase();

									arrTypes.push('while');
									
									if (strExpression.length > 0)
									{
										arrResult.push(	// later should generate labels and expression handling
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'while_start', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
										});
									}
									else
									{
										arrResult.push(	// later should generate labels and expression handling
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'while_start', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: '', generated: false, line: strLine_a
										});
									}

									arrLabels.push(intLabel);
									intLabel++;
								}
							}
						}
						else if (strInput.indexOf('}') === 0)	//	end nest
						{
							intBraceNestCount--;

							if (intBraceNestCount === 0)	// end class
							{
								blnInClass = false;

								arrResult.push(	// later should generate constructor
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: true, action: 'constructor_end', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: true, line: strLine_a
								});

								arrResult.push(	// later should generate constructor
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'class_end', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
								
								strConstructorPrefix = '';
								strInClassName = '';
							}
							else if (intBraceNestCount === 1)	// end function
							{
								if (blnInPrivateFunction)
								{
									arrResult.push(	// later should generate return
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'privatefunction_end', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									strConstructorPrefix = 'constructor_';
									blnInPrivateFunction = false;
									blnInPublicFunction = false;
									strInFunctionName = '';
								}
								else if (blnInPublicFunction)
								{
									arrResult.push(	// later should generate return
									{ 
										linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
										inconstructor: false, action: 'publicfunction_end', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
									strConstructorPrefix = 'constructor_';
									blnInPrivateFunction = false;
									blnInPublicFunction = false;
									strInFunctionName = '';
								}
								else
								{
									// end if or end while (within a constructor)
									intLabelPopped = arrLabels.pop();
									strType = arrTypes.pop();
									arrResult.push(	// later should generate return
									{ 
										linenumber: intLineNumber, label:intLabelPopped, nestcount: intBraceNestCount,
										inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + strType + '_end', error: '', classname: strInClassName, functionname: strInFunctionName,
										parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
									});
								}
							}
							else
							{
								// end if or end while (within a class function)
								intLabelPopped = arrLabels.pop();
								strType = arrTypes.pop();
								arrResult.push(	// later should generate labels
								{ 
									linenumber: intLineNumber, label:intLabelPopped, nestcount: intBraceNestCount,
									inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + strType + '_end', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
						}
						else if (strInput === 'return')	// return
						{
							if (blnInPrivateFunction || blnInPublicFunction)
							{
								arrResult.push(	// later should generate labels and storage
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: (strConstructorPrefix.length > 0), action: 'return_void', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'unexpected return', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
						}
						else if (strInput.indexOf('return ') === 0)	// return value
						{
							if (blnInPrivateFunction || blnInPublicFunction)
							{
								arrResult.push(	// later should generate labels and storage
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: (strConstructorPrefix.length > 0), action: 'return_value', error: '', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
							else
							{
								arrResult.push(
								{ 
									linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
									inconstructor: false, action: 'error', error: 'unexpected return', classname: strInClassName, functionname: strInFunctionName,
									parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
								});
							}
						}
						else
						{
							// assignment expressions
							intStart = 0; //strInput.indexOf(' ');
							intEnd = strInput.indexOf('=', intStart);
							blnFound = ((intStart >= 0) && (intEnd > 0));
							
							if (blnFound)
							{
								strVariable = strInput.substring(intStart, intEnd).trim().toUpperCase();
								strVariable = getVariable(strInClassName, strInFunctionName, strVariable);

								if (strVariable.length > 0)
								{
									intStart++;

									// get expression
									intStart = intEnd;
									intEnd = strInput.length - 1; //indexOf(')', intStart);
									blnFound = ((intStart > 0) && (intEnd > 0));
									
									if (blnFound)
									{
										intStart++;
										strExpression = strInput.substring(intStart, intEnd).trim().toUpperCase();

										if (strExpression.length > 0)
										{
											arrResult.push(	// later should generate labels and storage
											{ 
												linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
												inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'eval_expression', error: '', classname: strInClassName, functionname: strInFunctionName,
												parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
											});

											arrResult.push(	// later should generate labels and storage
											{ 
												linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
												inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'set_variable', error: '', classname: strInClassName, functionname: strInFunctionName,
												parameters: strParameters, expression: strExpression, generated: false, line: strVariable
											});
										}
									}
								}
							}
							else
							{
								// non-assignment expressions
								if (strLine_a.trim().length > 0)
								{
									intStart = strInput.indexOf(' ');
									intEnd = strInput.indexOf(';', intStart);
									blnFound = ((intStart >= 0) && (intEnd > 0));

									if (blnFound)
									{
										strVariable = strInput.substring(0, intStart).trim().toUpperCase();
										strVariable = getVariable(strInClassName, strInFunctionName, strVariable);

										strExpression = strInput.substring(0, intEnd).trim().toUpperCase();

										if (strExpression.length > 0)
										{
											arrResult.push(	// later should generate labels and storage
											{ 
												linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
												inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'eval_expression', error: '', classname: strInClassName, functionname: strInFunctionName,
												parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
											});

											arrResult.push(	// later should generate labels and storage
											{ 
												linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
												inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'set_variable', error: '', classname: strInClassName, functionname: strInFunctionName,
												parameters: strParameters, expression: strExpression, generated: false, line: strVariable
											});
										}
									}
									else
									{
										arrResult.push(	// later should generate labels and storage
										{ 
											linenumber: intLineNumber, label:intLabel, nestcount: intBraceNestCount,
											inconstructor: (strConstructorPrefix.length > 0), action: strConstructorPrefix + 'call', error: '', classname: strInClassName, functionname: strInFunctionName,
											parameters: strParameters, expression: strExpression, generated: false, line: strLine_a
										});
									}
								}
							}
						}
					}
				}
			}
		});
		
		return arrResult;
	}
	
	// parse 2 processes the output of parse 1 to generate code
	function parse2(arrInput_a)
	{
		var objLine = null;
		arrResult = [];
		
		function getFunction(objLine_a, str_a)
		{
			return '';
		}

		function getOperator(str_a)
		{
			var strResult = '';
			var intOperator = OPERATORMAP.indexOf('_' + str_a + '_');

			if (intOperator >= 0)
			{
				strResult = OPERATORMAP[intOperator + 1];
			}
			
			return strResult;
		}

		function getVariable(objLine_a, str_a)
		{
			var strResult = '';
			var strVariable = objLine_a.classname + '_' + objLine_a.functionname + '_' + str_a;
			
			if (isVariable(strVariable))
			{
				strResult = strVariable.toLowerCase();
			}
			else
			{
				strVariable = objLine_a.classname + '__' + str_a;
				
				if (isVariable(strVariable))
				{
					strResult = strVariable.toLowerCase();
				}
			}
			
			return strResult;
		}

		function isFunction(str_a)
		{
			return false;
		}
		
		function isVariable(str_a)
		{
			var blnResult = false;
			
			// process variables
			processArray(arrVariables, function(objVariable_a)
			{
				if (objVariable_a.line.toLowerCase() === str_a.toLowerCase())
				{
					blnResult = true;
					return true;
				}
			});
			
			return blnResult;
		}
		
		function outputCall(strLabel_a, strExtra_a)
		{
			return '\tcall ' + strLabel_a.toLowerCase() + '\\s' + strExtra_a;
		}
		
		function outputComment(strComment_a, strExtra_a)
		{
			return '\t\t\t\t; ' + strComment_a + '\\s' + strExtra_a;
		}
	
		function outputDefineWord(strLabel_a, strExtra_a)
		{
			return strLabel_a.toLowerCase() + ': defw 0\\s' + strExtra_a;
		}
		
		function outputExpression(objLine_a, strExpression_a, strExtra_a)
		{
			var strResult = '';
			var arrExpression = strExpression_a.split(' ');

			arrExpression = arrExpression.filter(function(str_a)
			{
				return str_a.trim().length > 0;
			});

			if (arrExpression[1] == 'NEW')
			{
				strResult += '\t; TODO NEW, object allocation ' + arrExpression[0] + '\\s';	// NOT YET IMPLEMENTED
			}
			else
			{
				if (arrExpression.length == 1)
				{
					var str = arrExpression[0].toLowerCase();
					var strVariable = getVariable(objLine_a, str);
					var strOperator = getOperator(str);
					var strFunction = getFunction(objLine_a, str);
					
					if (strVariable.length > 0)
					{
						strResult += '\tld hl, (' + strVariable + ")\\s";
						strResult += '\tpush hl\\s';
					}
					else if (strOperator.length > 0)
					{
						strResult += '\tcall ' + strOperator + '\\s';
					}
					else if (strFunction.length > 0)
					{
						strResult += '\t; TODO CALL, function ' + strFunction + '\\s';	// NOT YET IMPLEMENTED
					}
					else	// must be a literal
					{
						strResult += '\tld hl, ' + str + "\\s";
						strResult += '\tpush hl\\s';
					}
				}
				else
				{
					processArray(arrExpression, function(str_a)
					{
						var str = str_a.toLowerCase();
						var strVariable = getVariable(objLine_a, str);
						var strOperator = getOperator(str);
						var strFunction = getFunction(objLine_a, str);
						
						if (strVariable.length > 0)
						{
							strResult += '\tld hl, (' + strVariable + ")\\s";
							strResult += '\tpush hl\\s';
						}
						else if (strOperator.length > 0)
						{
							strResult += '\tcall ' + strOperator + '\\s';
						}
						else if (strFunction.length > 0)
						{
							strResult += '\t; TODO CALL, function ' + strFunction + '\\s';	// NOT YET IMPLEMENTED
						}
						else	// must be a literal
						{
							strResult += '\tld hl, ' + str + "\\s";
							strResult += '\tpush hl\\s';
						}
					});
				}
			}
			
			strResult += strExtra_a;
			
			return strResult;
		}
		
		function outputJump(strLabel_a, strExtra_a)
		{
			return '\tjp ' + strLabel_a.toLowerCase() + '\\s' + strExtra_a;
		}
		
		function outputJumpZero(strLabel_a, strExtra_a)
		{
			//return '\tjp z, ' + strLabel_a.toLowerCase() + '\\s' + strExtra_a;
			var strResult = '\tpop hl\\s';
			strResult += '\tld a,h\\s';
			strResult += '\tor l\\s';
			strResult += '\tjp z, ' + strLabel_a.toLowerCase() + '\\s' + strExtra_a;
			return strResult;
		}
		
		function outputLabel(strLabel_a, strExtra_a)
		{
			return strLabel_a.toLowerCase() + ':\\s' + strExtra_a;
		}
		
		function outputReturn(strExtra_a)
		{
			return '\tret\\s' + strExtra_a;
		}
		
		function outputSetVariable(strLabel_a, strExtra_a)
		{
			var strResult = '\tpop hl\\s';
			strResult += '\tld (' + strLabel_a.toLowerCase() + '), hl\\s' + strExtra_a + '\n';
			return strResult;
		}
		
		function processConstructors(strClassName_a)
		{
			// process constructors
			processArray(arrInput_a, function(objLine_a)
			{
				if ((objLine_a.classname == strClassName_a) && (objLine_a.inconstructor))
				{
					objLine = processLine(objLine_a);
					if (objLine !== null)
					{
						arrResult.push(objLine);
					}
				}
			});
		}
		
		function processNonConstructors()
		{
			processArray(arrInput_a, function(objLine_a)
			{
				if (!objLine_a.inconstructor)
				{
					objLine = processLine(objLine_a);
					if (objLine !== null)
					{
						arrResult.push(objLine);
					}
				}
			});
		}
		
		function processVariables(strClassName_a)
		{
			// process variables
			processArray(arrVariables, function(objLine_a)
			{
				if (objLine_a.classname == strClassName_a)
				{
					objLine = processLine(objLine_a);
					if (objLine !== null)
					{
						arrResult.push(objLine);
					}
				}
			});
		}
		
		function processLine(objLine_a)
		{
			objLine = objLine_a;
			var objResult = null;
			
			// class related
			if (objLine.action === 'class_end')
			{
				objResult = objLine;
				processConstructors(objResult.classname);
				processVariables(objResult.classname);
				
				if (objOptions_a.includesourceascomments)
				{
					objResult.line = outputComment(objResult.classname.toLowerCase() + ' ' + objResult.action + ', ' + objResult.line, "\n");
				}
				else
				{
					objResult = null;
				}
			}
			else if (objLine.action === 'class_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname, "");
			}
			else if (objLine.action === 'privatefunction_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.functionname, "");
			}
			else if (objLine.action === 'publicfunction_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.functionname, "");
			}

			// constructor related
			else if (objLine.action === 'call_constructor')
			{
				objResult = objLine;
				objResult.line = outputCall(objResult.classname + '_constructor', "");
			}
			else if (objLine.action === 'constructor_call')
			{
				objResult = objLine;
				objResult.line = '\t; TODO CALL, ' + objResult.action + ', ' + objResult.line + '\\s';	// NOT YET IMPLEMENTED
			}
			else if (objLine.action === 'constructor_declare_variable')
			{
				objResult = null;
			}
			else if (objLine.action === 'constructor_end')
			{
				objResult = objLine;
				objResult.line = outputReturn("\n");
			}
			else if (objLine.action === 'constructor_eval_expression')
			{
				objResult = objLine;
				if (objResult.expression.length > 0)
				{
					objResult.line = outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "");
				}
				else
				{
					objResult = null;
				}
			}
			else if (objLine.action === 'constructor_if_end')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.label + '_e', "");
			}
			else if (objLine.action === 'constructor_if_start')
			{
				objResult = objLine;
				objResult.line = outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "\n");
				objResult.line += outputJumpZero(objResult.classname + '_' + objResult.label + '_e', "");
			}
			else if (objLine.action === 'constructor_set_variable')
			{
				objResult = objLine;
				objResult.line = outputSetVariable(objResult.line, "");
			}
			else if (objLine.action === 'constructor_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_constructor', "");
			}
			else if (objLine.action === 'constructor_while_end')
			{
				objResult = objLine;
				objResult.line = outputJump(objResult.classname + '_' + objResult.label + '_s', "\n");
				objResult.line += outputLabel(objResult.classname + '_' + objResult.label + '_e', "");
			}
			else if (objLine.action === 'constructor_while_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.label + '_s', "\n");
				objResult.line += outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "\n");
				objResult.line += outputJumpZero(objResult.classname + '_' + objResult.label + '_e', "");
			}

			// function related
			else if (objLine.action === 'call')
			{
				objResult = objLine;
				objResult.line = '\t; TODO CALL, ' + objResult.action + ', ' + objResult.line + '\\s';	// NOT YET IMPLEMENTED
			}
			else if (objLine.action === 'declare_parameters')
			{
				objResult = objLine;
				if (objResult.parameters.length > 0)
				{
					objResult.line = '\t; TODO PARAMETERS, ' + objResult.action + ', ' + objResult.parameters + '\\s';	// NOT YET IMPLEMENTED
				}
				else
				{
					objResult = null;
				}
			}
			else if (objLine.action === 'declare_variable')
			{
				objResult = null;
			}
			else if (objLine.action === 'eval_expression')
			{
				objResult = objLine;
				if (objResult.expression.length > 0)
				{
					objResult.line = outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "");
				}
				else
				{
					objResult = null;
				}
			}
			else if (objLine.action === 'if_end')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.label + '_e', "");
			}
			else if (objLine.action === 'if_start')
			{
				objResult = objLine;
				objResult.line = outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "\n");
				objResult.line += outputJumpZero(objResult.classname + '_' + objResult.label + '_e', "");
			}
			else if (objLine.action === 'privatefunction_end')
			{
				objResult = objLine;
				objResult.line = outputReturn("\n");
			}
			else if (objLine.action === 'publicfunction_end')
			{
				objResult = objLine;
				objResult.line = outputReturn("\n");
			}
			else if (objLine.action === 'reserve_variable')
			{
				objResult = objLine;
				objResult.line = outputDefineWord(objResult.line, "");
			}
			else if (objLine.action === 'return_value')
			{
				objResult = objLine;
				objResult.line = '\t; TODO RETURN, ' + objResult.action + ', ' + objResult.line + '\\s';	// NOT YET IMPLEMENTED
			}
			else if (objLine.action === 'return_void')
			{
				objResult = objLine;
				objResult.line = outputReturn("\n");
			}
			else if (objLine.action === 'set_variable')
			{
				objResult = objLine;
				objResult.line = outputSetVariable(objResult.line, "");
			}
			else if (objLine.action === 'while_end')
			{
				objResult = objLine;
				objResult.line = outputJump(objResult.classname + '_' + objResult.label + '_s', "\n");
				objResult.line += outputLabel(objResult.classname + '_' + objResult.label + 'e', "");
			}
			else if (objLine.action === 'while_start')
			{
				objResult = objLine;
				objResult.line = outputLabel(objResult.classname + '_' + objResult.label + '_s', "\n");
				objResult.line += outputExpression(objResult, IFtoPF(objResult.expression, arrFunctions), "\n");
				objResult.line += outputJumpZero(objResult.classname + '_' + objResult.label + '_e', "\n");
			}

			// miscellaneous
			else if (objLine.action === 'original_comment')
			{
				objResult = objLine;
				objResult.line = outputComment(objResult.line, "");
			}
			else if (objLine.action === 'source_comment')
			{
				objResult = objLine;
				objResult.line = outputComment(objResult.line, "");
			}
			else if (objLine.action === 'whitespace')
			{
				objResult = objLine;
			}
			else
			{
				objResult = objLine;
				objResult.action = 'error';
				//objResult.error = 'invalid parse2 operation';
			}
			
			return objResult;
		}
		
		processNonConstructors();
		
		return arrResult;
	}
		
	arrOutput1 = parse1(arrInput);
	
	if (intBraceNestCount > 0)
	{
		arrOutput1.push(
		{ 
			linenumber: -1, label:intLabel, nestcount: intBraceNestCount,
			inconstructor: false, action: 'error', error: 'missing }', classname: strInClassName, functionname: strInFunctionName,
			parameters: strParameters, expression: strExpression, generated: false, line: ''
		});
	}
	
	if (objOptions.debugcompiler)
	{
		strResult += 'PARSE 1\n\n';
		processArray(arrOutput1, function(obj_a)
		{
			strResult += JSON.stringify(obj_a) + '\n';
		});
		strResult += '\n\n';
	}
	
	arrOutput2 = parse2(arrOutput1);
	
	if (objOptions.debugcompiler)
	{
		strResult += 'PARSE 2\n\n';
		processArray(arrOutput2, function(obj_a)
		{
			strResult += JSON.stringify(obj_a) + '\n';
		});
	}
	else
	{
		processArray(arrOutput2, function(obj_a)
		{
			var strLine = '';
			
			if ((objOptions.showsourcelinenumbers) && (obj_a.action !== 'original_comment') && (obj_a.action !== 'whitespace'))
			{
				strLine = obj_a.line;
				strLine = str_replace(strLine, '\\s', ' ; source line ' + obj_a.linenumber + '\n');
			}
			else
			{
				strLine = obj_a.line;
				strLine = str_replace(strLine, '\\s', '\n');
			}
			
			var strPrependLines = obj_a.prependlines;
			if (strPrependLines === undefined) { strPrependLines = ''; }

			var strAppendLines = obj_a.appendlines;
			if (strAppendLines === undefined) { strAppendLines = ''; }
			
			strLine = strPrependLines + strLine + strAppendLines;
			
			strResult += strLine;
		});
	}

	strResult += renderErrors();
	
	return strResult;
}
