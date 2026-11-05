// NASA / GEBCO の標高画像を球面へ投影し、高いほど暗い乗算用の画像を作る。
// 写真を開くまで画像も GPU も使わない。利用できない場合は通常の国別表示に戻る。
function createGlobeTerrain(onChange) {
  var canvas = document.createElement('canvas');
  var gl = null;
  var program = null;
  var texture = null;
  var vertices = null;
  var rotationUniform = null;
  var zoomUniform = null;
  var source = null;
  var pending = null;
  var available = false;

  function shader(type, code) {
    var result = gl.createShader(type);
    gl.shaderSource(result, code);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      gl.deleteShader(result);
      throw new Error('Terrain shader unavailable');
    }
    return result;
  }

  function initialize() {
    available = false;
    if (!gl || gl.isContextLost()) return;
    var vertex = shader(gl.VERTEX_SHADER, [
      'attribute vec2 position;',
      'varying vec2 point;',
      'void main() { point = position; gl_Position = vec4(position, 0.0, 1.0); }'
    ].join('\n'));
    var fragment = shader(gl.FRAGMENT_SHADER, [
      'precision highp float;',
      'varying vec2 point;',
      'uniform sampler2D terrain;',
      'uniform vec3 rotation;', // cos(緯度回転), sin(緯度回転), 経度回転
      'uniform float zoom;',
      'void main() {',
      '  vec2 p = point / (0.92 * zoom);',
      '  float front = sqrt(max(0.0, 1.0 - dot(p, p)));',
      // d3.geoOrthographic().rotate([lambda, phi]) の逆回転。
      '  float x = front * rotation.x + p.y * rotation.y;',
      '  float z = p.y * rotation.x - front * rotation.y;',
      '  float lon = atan(p.x, x) - rotation.z;',
      '  float lat = asin(clamp(z, -1.0, 1.0));',
      '  vec2 uv = vec2(lon / 6.28318530718 + 0.5, 0.5 - lat / 3.14159265359);',
      '  float height = texture2D(terrain, uv).r;',
      '  float brightness = mix(1.0, 0.38, pow(height, 0.65));',
      '  gl_FragColor = vec4(vec3(brightness), 1.0);',
      '}'
    ].join('\n'));
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Terrain renderer unavailable');
    gl.useProgram(program);

    vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    rotationUniform = gl.getUniformLocation(program, 'rotation');
    zoomUniform = gl.getUniformLocation(program, 'zoom');
    gl.uniform1i(gl.getUniformLocation(program, 'terrain'), 0);

    var pixels = source;
    var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (source.width > maxSize) {
      pixels = document.createElement('canvas');
      pixels.width = maxSize;
      pixels.height = maxSize / 2;
      pixels.getContext('2d').drawImage(source, 0, 0, pixels.width, pixels.height);
    }
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // 元画像は北が上。UV の y=0 を画像の先頭行に対応させる。
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    available = gl.getError() === gl.NO_ERROR;
  }

  function release() {
    available = false;
    if (!gl || gl.isContextLost()) return;
    gl.deleteTexture(texture);
    gl.deleteBuffer(vertices);
    gl.deleteProgram(program);
    texture = vertices = program = null;
  }

  canvas.addEventListener('webglcontextlost', function(event) {
    event.preventDefault();
    available = false;
    onChange();
  });
  canvas.addEventListener('webglcontextrestored', function() {
    try { if (source) initialize(); } catch (error) { release(); }
    onChange();
  });

  function load() {
    if (pending) return pending;
    pending = Promise.resolve().then(function() {
      gl = gl || canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
      if (!gl) return false;
      return new Promise(function(resolve, reject) {
        var image = new Image();
        image.onload = function() { resolve(image); };
        image.onerror = reject;
        image.src = 'images/globe-height.webp';
      }).then(function(image) {
        source = image;
        initialize();
        onChange();
        return available;
      });
    }).catch(function() {
      // 画像の一時的な読み込み失敗は、次に写真を開いたとき再試行する。
      release();
      pending = null;
      return false;
    });
    return pending;
  }

  function draw(size, rotation, zoom) {
    if (!available || gl.isContextLost()) return null;
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
    gl.viewport(0, 0, size, size);
    var radians = Math.PI / 180;
    gl.uniform3f(rotationUniform, Math.cos(rotation[1] * radians), Math.sin(rotation[1] * radians), rotation[0] * radians);
    gl.uniform1f(zoomUniform, zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }

  return { load: load, draw: draw };
}
