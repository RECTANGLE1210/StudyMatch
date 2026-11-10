-- Reference catalogs only; no fake users or application statistics.
insert into public.universities(name) values
 ('ĐH Bách Khoa Hà Nội'), ('ĐH Bách Khoa TP.HCM'), ('ĐH Kinh tế Quốc dân') on conflict(name) do nothing;
insert into public.majors(name) values ('Công nghệ thông tin'), ('Khoa học máy tính'), ('Kinh tế') on conflict(name) do nothing;
insert into public.subjects(code,name) values ('MT1003','Giải tích 1'),('CO2003','Cấu trúc dữ liệu'),('MT2013','Xác suất thống kê') on conflict(code) do nothing;
insert into public.topics(subject_id,name)
select s.id,t.name from public.subjects s join (values
 ('MT1003','Giới hạn'),('MT1003','Đạo hàm'),('MT1003','Chuỗi số'),('MT1003','Tích phân suy rộng'),
 ('CO2003','Mảng'),('CO2003','Cây'),('CO2003','Đồ thị'),('MT2013','Biến ngẫu nhiên'),('MT2013','Phân phối chuẩn')
) as t(code,name) on t.code=s.code on conflict(subject_id,name) do nothing;
