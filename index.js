function computeAdaptiveThreshold(sourceImageData, ratio, callback) {
  const integral = buildIntegral(sourceImageData);

  const width = sourceImageData.width;
  const height = sourceImageData.height;
  const s = width >> 4; // in fact it's s/2, but since we never use s...

  var sourceData = sourceImageData.data;
  var result = createImageData(width, height);
  var resultData = result.data;
  var resultData32 = new Uint32Array(resultData.buffer);

  var x = 0,
    y = 0,
    lineIndex = 0;

  for (y = 0; y < height; y++, lineIndex += width) {
    for (x = 0; x < width; x++) {

      var value = sourceData[(lineIndex + x) << 2];
      var x1 = Math.max(x - s, 0);
      var y1 = Math.max(y - s, 0);
      var x2 = Math.min(x + s, width - 1);
      var y2 = Math.min(y + s, height - 1);
      var area = (x2 - x1 + 1) * (y2 - y1 + 1);
      var localIntegral = getIntegralAt(integral, width, x1, y1, x2, y2);
      if (value * area > localIntegral * ratio) {
        resultData32[lineIndex + x] = 0xFFFFFFFF;
      } else {
        resultData32[lineIndex + x] = 0xFF000000;
      }
    }
  }
  return result;
}

function createImageData(width, height) {
  var canvas = document.createElement('canvas');
  return canvas.getContext('2d').createImageData(width, height);
}

function buildIntegral(sourceImageData) {
  const sourceData = sourceImageData.data;
  const width = sourceImageData.width;
  const height = sourceImageData.height;

  const integral = new Int32Array(width * height);

  var x = 0,
    y = 0,
    lineIndex = 0,
    sum = 0;

  for (x = 0; x < width; x++) {
    sum += sourceData[x << 2];
    integral[x] = sum;
  }

  for (y = 1, lineIndex = width; y < height; y++, lineIndex += width) {
    sum = 0;
    for (x = 0; x < width; x++) {
      sum += sourceData[(lineIndex + x) << 2];
      integral[lineIndex + x] = integral[lineIndex - width + x] + sum;
    }
  }
  return integral;
}

function getIntegralAt(integral, width, x1, y1, x2, y2) {
  var result = integral[x2 + y2 * width];
  if (y1 > 0) {
    result -= integral[x2 + (y1 - 1) * width];
    if (x1 > 0) {
      result += integral[(x1 - 1) + (y1 - 1) * width];
    }
  }
  if (x1 > 0) {
    result -= integral[(x1 - 1) + (y2) * width];
  }
  return result;
}



function imageDataToBoolArr(imageData) {
  // return imageData.data
  //   .filter((_, i) => !(i % 4))
  //   .map(x => x === 255 ? true : false)
  //   .reduce((rows, v, i) => {
  //     if (i % imageData.width) {
  //       rows[rows.length-1].push(v);
  //     } else {
  //       rows.push([v]);
  //     }
  //     return rows;
  //   }, []);
  const arr = [];
  for (let i = 0; i < imageData.height; i++) {
    const row = [];
    for (let j = 0; j < imageData.width; j++) {
      row.push(imageData.data[4*(i*imageData.width+j)] === 255)
      // row.push(false);
    }
    arr.push(row);
  }
  return arr;
}

function connectedComponents(boolArr) {
  const visited = [];
  for (let i = 0; i < boolArr.length; i++) {
    const row = [];
    for (let j = 0; j < boolArr[0].length; j++) {
      row.push(false);
    }
    visited.push(row);
  }

  const components = [];
  for (let i = 0; i < boolArr.length; i++) {
    for (let j = 0; j < boolArr[0].length; j++) {

      if (boolArr[i][j] || visited[i][j]) {
        continue;
      }
      const start = {i, j};
      const q = [start];
      const component = {
        topLeft: start,
        topRight: start,
        bottomLeft: start,
        bottomRight: start,
        size: 0,
      };
      while (q.length) {
        // debugger;
        const el = q.pop();
        if (visited[el.i][el.j]) {
          continue;
        }
        visited[el.i][el.j] = true;
        component.size++;

        if (el.i <= component.topLeft.i && el.j <= component.topLeft.j) {
          component.topLeft = el;
        }
        if (el.i >= component.topRight.i && el.j <= component.topRight.j) {
          component.topRight = el;
        }
        if (el.i <= component.bottomLeft.i && el.j >= component.bottomLeft.j) {
          component.bottomLeft = el;
        }
        if (el.i >= component.bottomRight.i && el.j >= component.bottomRight.j) {
          component.bottomRight = el;
        }

        for (let k = el.i-1; k < el.i+2; k++) {
          for (let l = el.j-1; l < el.j+2; l++) {
            if (k > 0 && k < boolArr[0].length && l > 0 && l < boolArr.length &&
                !boolArr[l][k] && !visited[l][k]) {
              q.push({i: k, j: l});
            }
          }
        }
      }
      components.push(component);
    }
  }
  // components.sort((a, b) => b.size - a.size);
  components.sort((a, b) =>
    (b.bottomRight.i - b.topLeft.i) * (b.bottomRight.j - b.topLeft.j) -
    (a.bottomRight.i - a.topLeft.i) * (a.bottomRight.j - a.topLeft.j)
  )
  return components;
}

function floodFill(ctx, width, height, x, y) {

  const imageData = ctx.getImageData(0, 0, width, height);
  const buffer = new Uint32Array(imageData.data.buffer);
  const colour = buffer[y * width + x];
  const q = [{x, y}];
  const visited = [];

  while (q.length) {
    const el = q.pop();
    if (visited[el.y * width + el.x]) {
      continue;
    }
    visited[el.y * width + el.x] = true;
    buffer[el.y * width + el.x] = 0xFF0000FF;

    for (let k = el.x-1; k < el.x+2; k++) {
      for (let l = el.y-1; l < el.y+2; l++) {
        if (k > 0 && k < width && l > 0 && l < height &&
            !visited[l * width + k] && buffer[l * width + k] === colour) {
          q.push({x: k, y: l});
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function paintPixel(ctx, width, height, x, y) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const buffer = new Uint32Array(imageData.data.buffer);
  buffer[imageData.width*y + x] = 0xFF0000FF;
  ctx.putImageData(imageData, 0, 0);
}

(function() {
  var testImageData;
  var ctx;

  var testImage = new Image();
  testImage.src = 'kakuro.png';
  testImage.onload = function() {
    var canvas = document.createElement('canvas');
    canvas.width = testImage.width;
    canvas.height = testImage.height;
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    ctx.drawImage(testImage, 0, 0);

    testImageData = ctx.getImageData(0, 0, testImage.width, testImage.height);

    var thresholdInput = document.getElementById('threshold');
    thresholdInput.oninput = function (input) {
      updateImage(input.value);
    };
    updateImage();

    canvas.onclick = ({offsetX, offsetY}) => {
      console.log(offsetX, offsetY);
      floodFill(ctx, testImage.width, testImage.height, offsetX, offsetY);
      // console.log(buffer);
      // ctx.getImageData(0, 0, testImage.width, testImage.height).data.
      // console.log('now it"s', ctx.getImageData(0, 0, testImage.width, testImage.height))
    };
  };

  document.body.appendChild(testImage);

  function updateImage(value) {
    value = value || +document.getElementById('threshold').value;
    var newTh = value / 100;
    var thresholded = computeAdaptiveThreshold(testImageData, newTh);
    console.log("thresholded", thresholded);
    const b = imageDataToBoolArr(thresholded);
    console.log("binary", b);
    const cc = connectedComponents(b);
    console.log("connectedComponents", cc);
    // console.log("cc small", connectedComponents([[false, false], [false, false]]))

    window.temp1 = thresholded;
    ctx.putImageData(thresholded, 0, 0);
    ctx.fillStyle = '#EE8888';
    ctx.fillText('current Threshold :' + newTh, 10, 20);
  }

  // updateImage();
})();
