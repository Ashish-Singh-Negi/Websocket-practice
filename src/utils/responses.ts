function successResponse(data: any) {
  return {
    success: true,
    data: data,
    error: null,
  };
}

function errorResponse(error: any) {
  return {
    success: false,
    data: null,
    error: error,
  };
}

export { successResponse, errorResponse };
