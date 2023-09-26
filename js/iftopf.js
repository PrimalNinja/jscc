// Developed by Julian Cassin. 2019-2020.
//
function IFtoPF(str_a, arrFunctions_a)
{
	var arrResultStack = [];
	var arrOperatorStack = [];
	var blnElementComplete = false;
	var blnEndBrace = false;
	var blnInIdentifier = false;
	var blnInOperator = false;
	var blnOpenBrace = false;
	var blnProceed = true;
	var blnSpecialChars = false;
	var lngI = 0;
	var strChar = '';
	var strElement = '';
	var strOperand = '';
	var strOperator = '';
	var strTopOperator = '';
	var strResult = '';

	// operators in precedence order
	var OPERATORS = ['_NEW_', '_!_', '_~_', '_++_', '_--_', '_**_', '_*_', '_/_', '_%_', '_+_', '_-_', '_<<_', '_>>_', '_>>>_', '_<_', '_<=_', '_>_', '_>=_', '_==_', '_!=_', '_===_', '_!==_', '_&_', '_^_', '_|_', '_&&_', '_||_', '_+=_', '_-=_', '_**=_', '_*=_', '_/=_', '_%=_', '_<<=_', '_>>=_', '_>>>=_', '_&=_', '_^=_', '_|=_']; // -x, TYPEOF, DELETE, IN, INSTANCEOF, ++x, --x unsupported, = treated special

	// utils
	function doNothing()
	{
		var todo = 'this function is just to stop lint errors where we dont want to do anything';
	}
	
	function todo()
	{
		var todo = 'this function is just to stop lint errors where we things to do';
	}
	
	strElement = '';
	strOperand = '';
	lngI = 0;
	while (lngI <= str_a.length)
	{
		blnEndBrace = false;
		blnElementComplete = false;
		blnOpenBrace = false;
		blnProceed = true;
		blnSpecialChars = false;
		if (lngI < str_a.length)
		{
			strChar = str_a.substr(lngI, 1);
		}
		else
		{
			strChar = '';
		}

		if (blnInIdentifier)
		{
			if (maybeIdentifier(strChar))
			{
				strElement += strChar;
			}
			else
			{
				blnElementComplete = true;
				blnInIdentifier = false;
				blnProceed = false;
			}
		}
		else if (blnInOperator)
		{
			if (maybeOperator(strChar))
			{
				strElement += strChar;
			}
			else
			{
				blnElementComplete = true;
				blnInOperator = false;
				blnProceed = false;
			}
		}
		else
		{
			if (maybeIdentifier(strChar))
			{
				strElement += strChar;
				blnInIdentifier = true;
			}
			else if (maybeOperator(strChar))
			{
				strElement += strChar;
				blnInOperator = true;
			}
			else
			{
				blnSpecialChars = true;
			}
		}

		// special characters
		if (blnSpecialChars)
		{
			if (strChar === '')
			{
				// do nothing
				doNothing();
			}
			else if (strChar === ' ')
			{
				strChar = ''; // whitespace becomes nothing
			}
			else if (strChar === ';')
			{
				blnElementComplete = true;
				strChar = '';
			}
			else if (strChar === '(')
			{
				blnElementComplete = true;
				blnOpenBrace = true;
			}
			else if (strChar === ')')
			{
				blnElementComplete = true;
				blnEndBrace = true;
			}
		}

		// end of line hanlding
		if (lngI == str_a.length)
		{
			if (!blnElementComplete)
			{
				strElement = strElement + strChar;
				blnElementComplete = true;
			}
		}

		if (blnElementComplete)
		{
			if (isOperator(OPERATORS, strElement)) // word operator
			{
				strOperator = strElement;
				strElement = '';
				//alert('operator:' + strOperator);
			}
			else if (isIdentifier(strElement))
			{
				// todo
				todo();
			}
			else if (isFunction(arrFunctions_a, strElement))
			{
				// todo
				todo();
			}
			else
			{
				strOperand = strElement;
				strElement = '';
				//alert('operand:' + strOperand);
			}

			if (strOperand.length > 0)
			{
				arrResultStack.push(strOperand);
			}

			if (arrOperatorStack.length === 0)
			{
				if (strOperator.length > 0)
				{
					arrOperatorStack.push(strOperator);
				}
			}
			else
			{
				strTopOperator = arrOperatorStack.pop();
				if (strTopOperator === '(')
				{
					arrOperatorStack.push(strTopOperator);
					if (strOperator.length > 0)
					{
						arrOperatorStack.push(strOperator);
					}
				}
				else
				{
					//alert(strTopOperator + " vs " + strOperator);
					if (precedence(OPERATORS, strTopOperator) <= precedence(OPERATORS, strOperator))
					{
						arrResultStack.push(strTopOperator);
						if (strOperator.length > 0)
						{
							arrOperatorStack.push(strOperator);
						}
					}
					else
					{
						arrOperatorStack.push(strTopOperator);
						if (strOperator.length > 0)
						{
							arrOperatorStack.push(strOperator);
						}
					}
				}
			}

			strOperand = '';
			strOperator = '';

			if (blnOpenBrace)
			{
				arrOperatorStack.push(strChar);
			}

			if (blnEndBrace)
			{
				strOperator = '';
				while ((arrOperatorStack.length > 0) && (strOperator != '('))
				{
					strOperator = arrOperatorStack.pop();
					if (strOperator != '(')
					{
						arrResultStack.push(strOperator);
					}
				}
			}
		}

		if (blnProceed)
		{
			lngI++;
		}
	}
  
	while (arrOperatorStack.length > 0)
	{
		strOperator = arrOperatorStack.pop();
		if (strOperator != '(')
		{
			arrResultStack.push(strOperator);
		}
	}

	while (arrResultStack.length > 0)
	{
		strOperand = arrResultStack.pop();
		strResult = strOperand + ' ' + strResult;
	}

	//alert(str_a + ":" + strResult);
	return strResult;
}

function isFunction(arrFunctions_a, str_a)
{
	return false;	// todo look up arrFunctions_a
}

function isIdentifier(str_a)
{
	return false;
}

function isOperator(arrOperators_a, strOperator_a)
{
	return (arrOperators_a.indexOf('_' + strOperator_a + '_') > -1);
}

function maybeIdentifier(str_a)
{
	return ("abcdefghijklmnopqrstuvwxyz1234567890".indexOf(str_a.toLowerCase()) > -1);
}

function maybeOperator(str_a)
{
	return ("!~+-*/%<>=&^|%".indexOf(str_a.toLowerCase()) > -1);
}

function precedence(arrOperators_a, strOperator_a)
{
	return arrOperators_a.indexOf('_' + strOperator_a + '_');
}
